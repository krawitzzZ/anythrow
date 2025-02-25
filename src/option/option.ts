import { isResult, isPromise, stringify, noop } from "../__internal";
import { AnyError } from "../error";
import {
  err,
  ok,
  Result,
  /* eslint-disable @typescript-eslint/no-unused-vars */
  type Ok,
  type Err,
  /* eslint-enable @typescript-eslint/no-unused-vars */
} from "../result";
import { MaybePromise } from "../types";
import { MaybePendingOption, PendingOption, pendingOption } from "./index";

/**
 * Represents a successful {@link Option} containing a value of type `T`.
 */
export type Some<T> = IOption<T> & { [phantom]: "some"; readonly value: T };

/**
 * Represents an empty {@link Option} with no value.
 */
export type None<T> = IOption<T> & { [phantom]: "none" };

/**
 * A type that represents either a value ({@link Some | Some\<T>}) or
 * no value ({@link None | None\<T>}).
 *
 * Inspired by Rust's {@link https://doc.rust-lang.org/std/option/enum.Option.html | Option}
 * type, this is used to handle values that may or may not be present, avoiding
 * null or undefined checks.
 */
export type Option<T> = Some<T> | None<T>;

/**
 * Creates a {@link Some} variant of an {@link Option} containing the given value.
 *
 * ### Example
 * ```ts
 * const x = some(42);
 * expect(x.isSome()).toBe(true);
 * expect(x.expect("Not 42")).toBe(42);
 * ```
 */
export function some<T>(value: T): Option<T> {
  return _Option.some(value);
}

/**
 * Creates a {@link None} variant of an {@link Option}, representing the absence of a value.
 *
 * ### Example
 * ```ts
 * const x = none<number>();
 * expect(x.isNone()).toBe(true);
 * expect(x.expect("x is `None`")).toThrow("x is `None`");
 * ```
 */
export function none<T>(): Option<T> {
  return _Option.none();
}

/**
 * Checks if a value is an {@link Option}, narrowing its type to `Option<unknown>`.
 *
 * This type guard determines whether the input is an instance conforms
 * to the {@link Option} interface.
 *
 * ### Example
 * ```ts
 * const x = some(42);
 * const y = none<number>();
 * const z = "not an option";
 *
 * expect(isOption(x)).toBe(true);
 * expect(isOption(y)).toBe(true);
 * expect(isOption(z)).toBe(false);
 *
 * if (isOption(x)) {
 *   expect(x.isSome()).toBe(true); // Type narrowed to Option<unknown>
 * }
 * ```
 */
export function isOption(x: unknown): x is Option<unknown> {
  return x instanceof _Option;
}

/**
 * Enumerates error codes specific to {@link Option} operations.
 *
 * These codes are used in {@link AnyError} instances thrown by methods like
 * {@link Option.unwrap} or {@link Option.expect} when operations fail due to
 * the state of the option.
 */
export enum OptionError {
  NoneValueAccessed = "NoneValueAccessed",
  NoneExpected = "NoneExpected",
  NoneUnwrapped = "NoneUnwrapped",
  PredicateException = "PredicateException",
}

/**
 * Interface defining the core functionality of an {@link Option}, inspired by Rust's
 * {@link https://doc.rust-lang.org/std/option/enum.Option.html | Option} type with
 * additional methods for enhanced usability in TypeScript.
 *
 * This interface represents a value that may or may not be present, providing a robust
 * alternative to `null` or `undefined`. It encapsulates most methods from Rust's
 * `Option` (e.g., {@link IOption.map}, {@link IOption.andThen}, {@link IOption.unwrap}),
 * which allow for safe transformations and access to the contained value, if any.
 * Beyond Rust's standard, it includes extra methods such as {@link toPendingOption}
 * and asynchronous variants like {@link IOption.and} with {@link Promise} support, tailored
 * for TypeScript's type system and JavaScript's asynchronous nature.
 *
 * For methods that accept functions or predicates (e.g., {@link IOption.orElse},
 * {@link IOption.filter}, {@link IOption.map}, {@link IOption.andThen}), if the
 * provided function throws an exception, the method returns {@link None} instead
 * of propagating the error. This ensures type safety and predictable behavior,
 * making {@link Option} reliable for use in any context, even where errors might occur.
 *
 * In case if you are concerned about possible errors, consider using methods like
 * {@link IOption.okOr} or {@link IOption.okOrElse} to convert the option into {@link Result}.
 *
 * Implementations of this interface, such as {@link Some} and {@link None}, provide
 * concrete behavior for these methods, enabling pattern matching, transformations,
 * and error handling in a type-safe manner.
 */
type IOption<T> = {
  /**
   * Returns {@link None} if the option is {@link None}, otherwise returns `x`.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none();
   *
   * expect(x.and(some(3)).toStrictEqual(some(3));
   * expect(x.and(none()).toStrictEqual(none());
   * expect(y.and(some(3)).toStrictEqual(none());
   * expect(y.and(none()).toStrictEqual(none());
   * ```
   */
  and<U>(x: Option<U>): Option<U>;
  /**
   * Returns {@link PendingOption} with {@link None} if the promise resolves to
   * {@link None} , otherwise returns {@link PendingOption} with `x`.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none();
   *
   * expect(x.and(Promise.resolve(some(3))).toBeInstanceOf(PendingOption);
   * expect(await x.and(Promise.resolve(some(3))).toStrictEqual(some(3));
   * expect(await x.and(Promise.resolve(none())).toStrictEqual(none());
   * expect(await y.and(Promise.resolve(some(3))).toStrictEqual(none());
   * expect(await y.and(Promise.resolve(none())).toStrictEqual(none());
   * ```
   */
  and<U>(x: Promise<Option<U>>): PendingOption<U>;
  /**
   * Applies `f` to the contained value if {@link Some}, returning its result; otherwise,
   * returns {@link None}. Also known as flatMap.
   *
   * ### Note
   * If `f` throws, {@link None} is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.andThen(n => some(n * 2))).toStrictEqual(some(4));
   * expect(x.andThen(_ => { throw new Error() })).toStrictEqual(none());
   * expect(x.andThen(_ => none())).toStrictEqual(none());
   * expect(y.andThen(n => some(n * 2))).toStrictEqual(none());
   * ```
   */
  andThen<U>(f: (x: T) => Option<U>): Option<U>;
  /**
   * Applies `f` to the contained value if {@link Some}, returning a {@link PendingOption}
   * with its async result; otherwise, returns {@link PendingOption} with {@link None}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.andThen(n => Promise.resolve(some(n * 2)))).toBeInstanceOf(PendingOption);
   * expect(await x.andThen(n => Promise.resolve(some(n * 2)))).toStrictEqual(some(4));
   * expect(await x.andThen(_ => Promise.resolve(none()))).toStrictEqual(none());
   * expect(await y.andThen(n => Promise.resolve(some(n * 2)))).toStrictEqual(none());
   * ```
   */
  andThen<U>(f: (x: T) => Promise<Option<U>>): PendingOption<U>;
  /**
   * Returns a shallow copy of the {@link Option}.
   *
   * ### Example
   * ```ts
   * const x = some({ a: 1 });
   * const y = none<{ a: number }>();
   *
   * expect(x.clone()).toStrictEqual(some({ a: 1 }));
   * expect(x.clone()).not.toBe(x); // Different reference
   * expect(y.clone()).toStrictEqual(none());
   * ```
   */
  clone(): Option<T>;
  /**
   * Returns the contained value if {@link Some}, or throws {@link AnyError}
   * with the provided message (or a default) if {@link None}.
   *
   * ## Throws
   * {@link AnyError} if value is {@link None}
   *
   * ### Example
   * ```ts
   * const x = some(42);
   * const y = none<number>();
   *
   * expect(x.expect("Missing value")).toBe(42);
   * expect(() => y.expect("Missing value")).toThrow("Missing value");
   * expect(() => y.expect()).toThrow(AnyError); // Default message
   * ```
   */
  expect(msg?: string): T;
  /**
   * Returns the option if {@link Some} and `f` returns `true`, otherwise returns {@link None}.
   *
   * ### Note
   * If `f` throws, {@link None} is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.filter(n => n > 0)).toStrictEqual(some(2));
   * expect(x.filter(n => n < 0)).toStrictEqual(none());
   * expect(x.filter(_ => { throw new Error() })).toStrictEqual(none());
   * expect(y.filter(n => n > 0)).toStrictEqual(none());
   * ```
   */
  filter(f: (x: T) => boolean): Option<T>;
  /**
   * Flattens an {@link Option} of an {@link Option} into a single {@link Option}.
   *
   * Think of it as of unwrapping a box inside a box.
   *
   * ### Example
   * ```ts
   * const x: Option<Option<Option<number>>> = some(some(some(6)));
   * const y: Option<Option<number>> = x.flatten();
   * const z = none<Option<number>>();
   *
   * expect(x.flatten()).toStrictEqual(some(some(6)));
   * expect(y.flatten()).toStrictEqual(none());
   * expect(z.flatten()).toStrictEqual(none());
   * ```
   */
  flatten<U>(this: Option<Option<U>>): Option<U>;
  /**
   * Returns the contained value if {@link Some}, or inserts and returns `x`
   * if {@link None}.
   *
   * See also {@link insert} method, which updates the value even if the option
   * already contains {@link Some}.
   *
   * ### Note
   * This method mutates the option.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.getOrInsert(5)).toBe(2);
   * expect(y.getOrInsert(5)).toBe(5);
   * expect(y).toStrictEqual(some(5)); // y is mutated
   * ```
   */
  getOrInsert(x: T): T;
  /**
   * Returns the contained value if {@link Some}, or inserts and returns the
   * result of `f` if {@link None}.
   *
   * ## Throws
   * If `f` throws, rethrows {@link AnyError} with original error being set as
   * {@link AnyError.originalError}.
   *
   * ### Note
   * This method mutates the option. If `f` throws, the option **remains unchanged**.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   * const z = none<number>();
   *
   * expect(x.getOrInsertWith(() => 5)).toBe(2);
   * expect(y.getOrInsertWith(() => 5)).toBe(5);
   * expect(y).toStrictEqual(some(5)); // y is mutated
   * expect(() => z.getOrInsertWith(() => { throw new Error() })).toThrow(AnyError);
   * ```
   */
  getOrInsertWith(f: () => T): T;
  /**
   * Inserts `x` into the option and returns it, overwriting any existing value.
   *
   * See also {@link getOrInsert} method, which doesn’t update the value if the
   * option already contains {@link Some}.
   *
   * ### Note
   * This method mutates the option.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.insert(5)).toBe(5);
   * expect(x).toStrictEqual(some(5));
   * expect(y.insert(5)).toBe(5);
   * expect(y).toStrictEqual(some(5));
   * ```
   */
  insert(x: T): T;
  /**
   * Calls `f` with the contained value if {@link Some}, then returns the original option.
   *
   * If `f` throws, the error is silently ignored.
   *
   * ### Note
   * Returns a new {@link Option} instance with the same value as the original, rather
   * than the exact same reference. The returned option is a distinct object, preserving
   * the original value.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   * let sideEffect = 0;
   *
   * expect(x.inspect(n => (sideEffect = n))).toStrictEqual(some(2));
   * expect(x.inspect(_ => { throw new Error() })).toStrictEqual(some(2));
   * expect(sideEffect).toBe(2);
   * expect(y.inspect(n => (sideEffect = n))).toStrictEqual(none());
   * expect(sideEffect).toBe(2); // Unchanged
   * ```
   */
  inspect(f: (x: T) => unknown): Option<T>;
  /**
   * Returns `true` if the option is {@link None}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.isNone()).toBe(false);
   * expect(y.isNone()).toBe(true);
   * ```
   */
  isNone(): this is None<T>;
  /**
   * Returns `true` if the option is {@link None} or if `f` returns `true` for the contained value.
   *
   * ### Note
   * If `f` throws, `false` is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.isNoneOr(n => n > 0)).toBe(true);
   * expect(x.isNoneOr(_ => { throw new Error() })).toBe(false);
   * expect(x.isNoneOr(n => n < 0)).toBe(false);
   * expect(y.isNoneOr(n => n > 0)).toBe(true);
   * ```
   */
  isNoneOr(f: (x: T) => boolean): boolean;
  /**
   * Returns `true` if the option is {@link Some}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.isSome()).toBe(true);
   * expect(y.isSome()).toBe(false);
   * ```
   */
  isSome(): this is Some<T>;
  /**
   * Returns `true` if the option is {@link Some} and `f` returns `true` for the contained value.
   *
   * ### Note
   * If `f` throws, `false` is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.isSomeAnd(n => n > 0)).toBe(true);
   * expect(x.isSomeAnd(_ => { throw new Error() })).toBe(false);
   * expect(x.isSomeAnd(n => n < 0)).toBe(false);
   * expect(y.isSomeAnd(n => n > 0)).toBe(false);
   * ```
   */
  isSomeAnd(f: (x: T) => boolean): this is Some<T> & boolean;
  /**
   * Maps the contained value with `f` if {@link Some}, returning a new {@link Option}; otherwise,
   * returns {@link None}.
   *
   * ### Note
   * If `f` throws, {@link None} is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.map(n => n * 2)).toStrictEqual(some(4));
   * expect(x.map(n => { throw new Error() })).toStrictEqual(none());
   * expect(y.map(n => n * 2)).toStrictEqual(none());
   * ```
   */
  map<U>(f: (x: T) => U): Option<U>;
  /**
   * Returns `f` applied to the contained value if {@link Some}, otherwise returns `def`.
   *
   * ### Note
   * If `f` throws, the error is silently ignored and `def` is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.mapOr(0, n => n * 2)).toBe(4);
   * expect(x.mapOr(0, _ => { throw new Error() })).toBe(0);
   * expect(y.mapOr(0, n => n * 2)).toBe(0);
   * ```
   */
  mapOr<U>(def: U, f: (x: T) => U): U;
  /**
   * Returns `f` applied to the contained value if {@link Some}, otherwise
   * returns the result of `mkDef`.
   *
   * ## Throws
   * If `mkDef` is called and throws, rethrows {@link AnyError} with original error
   * being set as {@link AnyError.originalError}.
   *
   * ### Note
   * If `f` throws, the error is silently ignored and result of `mkDef` is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.mapOrElse(() => 0, n => n * 2)).toBe(4);
   * expect(x.mapOrElse(() => 1, _ => { throw new Error() })).toBe(1);
   * expect(() => x.mapOrElse(() => { throw new Error() }, _ => { throw new Error() })).toThrow(AnyError);
   * expect(y.mapOrElse(() => 0, n => n * 2)).toBe(0);
   * ```
   */
  mapOrElse<U>(mkDef: () => U, f: (x: T) => U): U;
  /**
   * Matches the option, returning `f` applied to the value if {@link Some}, or `g` if {@link None}.
   *
   * ## Throws
   * If either `f` or `g` throws, rethrows {@link AnyError} with original error
   * being set as {@link AnyError.originalError}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.match(n => n * 2, () => 0)).toBe(4);
   * expect(() => x.match(_ => { throw new Error() }, () => 0)).toThrow(AnyError);
   * expect(y.match(n => n * 2, () => 0)).toBe(0);
   * expect(() => y.match(n => n * 2, () => { throw new Error() })).toThrow(AnyError);
   * ```
   */
  match<U, F = U>(f: (x: T) => U, g: () => F): U | F;
  /**
   * Converts to a {@link Result}, using `y` as the error value if {@link None}.
   *
   * {@link Some | Some(v)} is mapped to {@link Ok | Ok(v)} and {@link None} to {@link Err | Err(y)}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.okOr("error")).toStrictEqual(ok(2));
   * expect(y.okOr("error")).toStrictEqual(err("error"));
   * ```
   */
  okOr<E>(y: E): Result<T, E>;
  /**
   * Converts to a {@link Result}, using the result of `mkErr` as the error value if {@link None}.
   *
   * {@link Some | Some(v)} is mapped to {@link Ok | Ok(v)} and {@link None} to {@link Err | Err(mkErr())}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.okOrElse(() => "error")).toStrictEqual(ok(2));
   * expect(y.okOrElse(() => "error")).toStrictEqual(err("error"));
   * ```
   */
  // TODO(nikita.demin): think of how to handle the error if thrown (after result is done)
  okOrElse<E>(mkErr: () => E): Result<T, E>;
  /**
   * Returns the current option if it is {@link Some}, otherwise returns `x`.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.or(some(3))).toStrictEqual(some(2));
   * expect(x.or(none())).toStrictEqual(some(2));
   * expect(y.or(some(3))).toStrictEqual(some(3));
   * expect(y.or(none())).toStrictEqual(none());
   * ```
   */
  or(x: Option<T>): Option<T>;
  /**
   * Returns a {@link PendingOption} with the current value if this option is
   * {@link Some}, otherwise with `x`.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.or(Promise.resolve(some(3)))).toBeInstanceOf(PendingOption);
   * expect(await x.or(Promise.resolve(some(3)))).toStrictEqual(some(2));
   * expect(await y.or(Promise.resolve(some(3)))).toStrictEqual(some(3));
   * expect(await y.or(Promise.resolve(none()))).toStrictEqual(none());
   * ```
   */
  or(x: Promise<Option<T>>): PendingOption<T>;
  /**
   * Returns the current option if {@link Some}, otherwise returns the result of `f`.
   *
   * ### Note
   * If `f` throws, {@link None} is returned.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.orElse(() => some(3))).toStrictEqual(some(2));
   * expect(y.orElse(() => some(3))).toStrictEqual(some(3));
   * expect(y.orElse(() => { throw new Error() })).toStrictEqual(none());
   * expect(y.orElse(() => none())).toStrictEqual(none());
   * ```
   */
  orElse(f: () => Option<T>): Option<T>;
  /**
   * Replaces the current value with `x` and returns the old option.
   *
   * ### Note
   * This method mutates the option.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.replace(5)).toStrictEqual(some(2));
   * expect(x).toStrictEqual(some(5));
   * expect(y.replace(5)).toStrictEqual(none());
   * expect(y).toStrictEqual(some(5)); // y is mutated
   * ```
   */
  replace(x: T): Option<T>;
  /**
   * Special case of {@link replace} for async `x`.
   *
   * Asynchronously replaces the current {@link Option} with the resolved value of `x`,
   * returning the original value and a {@link Promise} that triggers the replacement.
   *
   * Since `x` is a {@link Promise} that resolves asynchronously, this method defers the
   * update until `x` resolves. It:
   * 1. Captures the current {@link Option} (either {@link Some} or {@link None}).
   * 2. Returns a tuple where:
   *    - The first element is the original {@link Option} before any changes.
   *    - The second element is a {@link Promise} that, when awaited, mutates this
   *      {@link Option} to {@link Some} containing the resolved value of `x`.
   * 3. If `x` rejects, no mutation occurs, and the option remains unchanged.
   *
   * This is an asynchronous variant of {@link Option.replace}, designed for deferred
   * updates with pending values.
   *
   * ### Note
   * This method mutates the original {@link Option}, but the mutation is deferred until
   * the returned {@link Promise} resolves successfully. The option remains in its
   * original state until then.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * const xResult = x.replace(Promise.resolve(5));
   * const yResult = y.replace(Promise.resolve(3));
   *
   * // Check tuple structure
   * expect(xResult).toHaveLength(2);
   * expect(xResult[0]).toStrictEqual(some(2)); // Original value
   * expect(xResult[1]).toBeInstanceOf(Promise);
   * expect(x.isSome()).toBe(true); // x unchanged until promise resolves
   * await xResult[1]; // Trigger mutation
   * expect(x).toStrictEqual(some(5)); // x is now Some(5)
   *
   * expect(yResult).toHaveLength(2);
   * expect(yResult[0]).toStrictEqual(none()); // Original value
   * expect(yResult[1]).toBeInstanceOf(Promise);
   * expect(y.isNone()).toBe(true); // y unchanged until promise resolves
   * await yResult[1]; // Trigger mutation
   * expect(y).toStrictEqual(some(3)); // y is now Some(3)
   * ```
   */
  replace(x: Promise<T>): readonly [Option<T>, Promise<void>];
  /**
   * Takes the value out of the option, leaving {@link None} in its place.
   *
   * ### Note
   * This method mutates the option.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.take()).toStrictEqual(some(2));
   * expect(x).toStrictEqual(none());
   * expect(y.take()).toStrictEqual(none());
   * expect(y).toStrictEqual(none());
   * ```
   */
  take(): Option<T>;
  /**
   * Takes the value if {@link Some} and `f` returns `true`, leaving {@link None} otherwise.
   *
   * ### Note
   * This method mutates the option.
   * If `f` throws, {@link None} is returned, and the original value **remains unchanged**.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   * const z = some(1);
   *
   * expect(x.takeIf(n => n > 0)).toStrictEqual(some(2));
   * expect(x).toStrictEqual(none());
   * expect(x.takeIf(n => n < 0)).toStrictEqual(none());
   * expect(y.takeIf(n => n > 0)).toStrictEqual(none());
   * expect(z.takeIf(_ => { throw new Error() })).toStrictEqual(none())
   * expect(z).toStrictEqual(some(1));
   * ```
   */
  takeIf(f: (x: T) => boolean): Option<T>;
  /**
   * Converts the option to a {@link PendingOption}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.toPendingOption()).toBeInstanceOf(PendingOption);
   * expect(await x.toPendingOption()).toStrictEqual(some(2));
   * expect(await y.toPendingOption()).toStrictEqual(none());
   * ```
   */
  toPendingOption(): PendingOption<T>;
  /**
   * Returns a string representation of the option.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.toString()).toBe("Some { 2 }");
   * expect(y.toString()).toBe("None");
   * ```
   */
  toString(): string;
  /**
   * Transposes an {@link Option} of a {@link Result} into a {@link Result} of an {@link Option}.
   *
   * {@link None} will be mapped to {@link Ok}({@link None}).
   * {@link Some}({@link Ok | Ok(_)}) and {@link Some}({@link Err | Err(_)})
   * will be mapped to {@link Ok}({@link Some | Some(_)}) and {@link Err | Err(_)}.
   *
   * ### Example
   * ```ts
   * const x = some(ok(2));
   * const y = some(err("error"));
   * const z = none<Result<number, string>>();
   *
   * expect(x.transposeResult()).toStrictEqual(ok(some(2)));
   * expect(y.transposeResult()).toStrictEqual(err("error"));
   * expect(z.transposeResult()).toStrictEqual(ok(none()));
   * ```
   */
  transposeResult<U, E>(this: Option<Result<U, E>>): Result<Option<U>, E>;
  /**
   * Transposes an {@link Option} of a {@link PromiseLike} into a
   * {@link PendingOption} of {@link Awaited}.
   *
   * ### Example
   * ```ts
   * const x: Option<Promise<Promise<string | number>>> = getOption();
   * const y: PendingOption<string | number> = x.transposeAwaitable();
   *
   * const a: Option<Promise<PendingOption<number>>> = getOption();
   * const b: PendingOption<Option<number>> = a.transposeAwaitable();
   * ```
   */
  transposeAwaitable<U>(
    this: Option<PromiseLike<U>>,
  ): PendingOption<Awaited<U>>;
  /**
   * Returns the contained value if {@link Some}, or throws {@link AnyError} if {@link None}.
   *
   * ## Throws
   * {@link AnyError} if value is {@link None}
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.unwrap()).toBe(2);
   * expect(() => y.unwrap()).toThrow("`unwrap` is called on `None`");
   * ```
   */
  unwrap(): T;
  /**
   * Returns the contained value if {@link Some}, or `def` if {@link None}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.unwrapOr(0)).toBe(2);
   * expect(y.unwrapOr(0)).toBe(0);
   * ```
   */
  unwrapOr(def: T): T;
  /**
   * Returns the contained value if {@link Some}, or the result of `mkDef` if {@link None}.
   *
   * ## Throws
   * If `mkDef` throws, rethrows {@link AnyError} with original error being
   * set as {@link AnyError.originalError}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.unwrapOrElse(() => 0)).toBe(2);
   * expect(y.unwrapOrElse(() => 0)).toBe(0);
   * expect(() => y.unwrapOrElse(() => { throw new Error() })).toThrow(AnyError);
   * ```
   */
  unwrapOrElse(mkDef: () => T): T;
  /**
   * Returns {@link Some} if exactly one of `this` or `y` is {@link Some}, otherwise returns {@link None}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.xor(some(3))).toStrictEqual(none());
   * expect(x.xor(none())).toStrictEqual(some(2));
   * expect(y.xor(some(3))).toStrictEqual(some(3));
   * expect(y.xor(none())).toStrictEqual(none());
   * ```
   */
  xor(y: Option<T>): Option<T>;
  /**
   * Returns a {@link PendingOption} with {@link Some} if exactly one of `this` or `y` is
   * {@link Some}, otherwise with {@link None}.
   *
   * ### Example
   * ```ts
   * const x = some(2);
   * const y = none<number>();
   *
   * expect(x.xor(Promise.resolve(some(3)))).toBeInstanceOf(PendingOption);
   * expect(await x.xor(Promise.resolve(some(3)))).toStrictEqual(none());
   * expect(await x.xor(Promise.resolve(none()))).toStrictEqual(some(2));
   * expect(await y.xor(Promise.resolve(some(3)))).toStrictEqual(some(3));
   * ```
   */
  xor(y: Promise<Option<T>>): PendingOption<T>;
};

/**
 * Type that represents the absence of a value.
 *
 * This allows {@link Option | Options} to also contain values of type `null`
 * or `undefined`, e.g. `Option<null>` or `Option<undefined>`.
 */
type Nothing = typeof nothing;

/**
 * A private symbol used internally as a discriminant to distinguish between
 * {@link Some} and {@link None} variants of an {@link Option}.
 *
 * This symbol is not accessible outside the module and exists solely to aid
 * TypeScript's type narrowing.
 */
const phantom: unique symbol = Symbol("Phantom");
const nothing: unique symbol = Symbol("Nothing");
const isNothing = (x: unknown): x is Nothing => x === nothing;
const mkAnyError = (msg: string, reason: OptionError, e: unknown) =>
  new AnyError(msg, reason, e instanceof Error ? e : new Error(stringify(e)));

/**
 * Internal implementation class for {@link Option}.
 *
 * Represents a value that may or may not be present.
 */
class _Option<T> implements IOption<T> {
  /**
   * A private symbol-keyed property used as a type discriminant.
   *
   * This field holds either `"some"` or `"none"` to indicate whether the
   * {@link Option} is a {@link Some} or {@link None} variant. It is not
   * intended for direct access or modification by users; instead, it serves as
   * an internal mechanism to enable TypeScript's type narrowing for methods
   * like {@link isSome} and {@link isNone}. The symbol key (`phantom`) ensures
   * this property remains private to the module, preventing external
   * interference while allowing the class to mutate its state (e.g., from
   * `None` to `Some`) as needed.
   *
   * @internal
   */
  [phantom]: "some" | "none" = "none";

  static some<T>(value: T): Option<T> {
    return new _Option(value);
  }

  static none<T>(): Option<T> {
    return new _Option();
  }

  #value: T | Nothing = nothing;

  get value(): T {
    if (isNothing(this.#value)) {
      throw new AnyError(
        "`value` is accessed on `None`",
        OptionError.NoneValueAccessed,
      );
    }

    return this.#value;
  }

  private constructor(value?: T) {
    // no arguments => `None` is created
    // argument provided => `Some` is created, even if it's undefined
    if (arguments.length > 0) {
      this.#setValue(value as T);
    }
  }

  and<U>(x: Option<U>): Option<U>;
  and<U>(x: Promise<Option<U>>): PendingOption<U>;
  and<U>(x: MaybePromise<Option<U>>): MaybePendingOption<U> {
    if (isPromise(x)) {
      return this.toPendingOption().and(x);
    }

    return this.isNone() ? none() : x;
  }

  andThen<U>(f: (x: T) => Option<U>): Option<U>;
  andThen<U>(f: (x: T) => Promise<Option<U>>): PendingOption<U>;
  andThen<U>(f: (x: T) => MaybePromise<Option<U>>): MaybePendingOption<U> {
    if (this.isNone()) {
      return none();
    }

    try {
      const option = f(this.value);
      return isPromise(option) ? pendingOption(option) : option;
    } catch {
      return none();
    }
  }

  clone(): Option<T> {
    return this.isNone() ? none() : some(this.value);
  }

  expect(msg?: string): T {
    if (this.isSome()) {
      return this.value;
    }

    throw new AnyError(
      msg ?? "`expect` is called on `None`",
      OptionError.NoneExpected,
    );
  }

  filter(f: (x: T) => boolean): Option<T> {
    if (this.isNone()) {
      return none();
    }

    try {
      return f(this.value) ? some(this.value) : none();
    } catch {
      return none();
    }
  }

  flatten<U>(this: _Option<Option<U>>): Option<U> {
    if (this.isNone()) {
      return none();
    }

    if (isOption(this.value)) {
      return this.value.clone();
    }

    return some(this.value);
  }

  getOrInsert(x: T): T {
    if (this.isNone()) {
      this.#setValue(x);
    }

    return this.value;
  }

  getOrInsertWith(f: () => T): T {
    if (this.isNone()) {
      try {
        this.#setValue(f());
      } catch (e) {
        throw mkAnyError(
          "getOrInsertWith callback threw an exception",
          OptionError.PredicateException,
          e,
        );
      }
    }

    return this.value;
  }

  insert(x: T): T {
    this.#setValue(x);

    return this.value;
  }

  inspect(f: (x: T) => unknown): Option<T> {
    if (this.isSome()) {
      try {
        f(this.value);
      } catch {
        // do not care about the error
      }
    }

    return some(this.value);
  }

  isNone(): this is None<T> {
    return this.#value === nothing;
  }

  isNoneOr(f: (x: T) => boolean): boolean {
    if (this.isNone()) {
      return true;
    }

    try {
      return f(this.value);
    } catch {
      return false;
    }
  }

  isSome(): this is Some<T> {
    return !this.isNone();
  }

  isSomeAnd(f: (x: T) => boolean): this is Some<T> & boolean {
    if (this.isSome()) {
      return true;
    }

    try {
      return f(this.value);
    } catch {
      return false;
    }
  }

  map<U>(f: (x: T) => U): Option<U> {
    if (this.isNone()) {
      return none();
    }

    try {
      return some(f(this.value));
    } catch {
      return none();
    }
  }

  mapOr<U>(def: U, f: (x: T) => U): U {
    if (this.isNone()) {
      return def;
    }

    try {
      return f(this.value);
    } catch {
      return def;
    }
  }

  mapOrElse<U>(mkDef: () => U, f: (x: T) => U): U {
    const makeDefault = () => {
      try {
        return mkDef();
      } catch (e) {
        throw mkAnyError(
          "mapOrElse `mkDef` callback threw an exception",
          OptionError.PredicateException,
          e,
        );
      }
    };

    if (this.isNone()) {
      return makeDefault();
    }

    try {
      return f(this.value);
    } catch (e) {
      if (e instanceof AnyError) {
        throw e; // if value getter threw => rethrow
      }

      return makeDefault();
    }
  }

  match<U, F = U>(f: (x: T) => U, g: () => F): U | F {
    try {
      return this.isSome() ? f(this.value) : g();
    } catch (e) {
      if (e instanceof AnyError) {
        throw e; // if value getter threw => rethrow
      }

      throw mkAnyError(
        "one of match predicates threw an exception",
        OptionError.PredicateException,
        e,
      );
    }
  }

  okOr<E>(y: E): Result<T, E> {
    return this.isSome() ? ok(this.value) : err(y);
  }

  okOrElse<E>(mkErr: () => E): Result<T, E> {
    return this.isSome() ? ok(this.value) : err(mkErr());
  }

  or(x: Option<T>): Option<T>;
  or(x: Promise<Option<T>>): PendingOption<T>;
  or(x: MaybePromise<Option<T>>): MaybePendingOption<T> {
    if (isPromise(x)) {
      return this.toPendingOption().or(x);
    }

    return this.isSome() ? some(this.value) : x;
  }

  orElse(f: () => Option<T>): Option<T> {
    try {
      return this.isSome() ? some(this.value) : f();
    } catch {
      return none();
    }
  }

  replace(x: T): Option<T>;
  replace(x: Promise<T>): readonly [Option<T>, Promise<void>];
  replace(x: MaybePromise<T>): Option<T> | readonly [Option<T>, Promise<void>] {
    if (isPromise(x)) {
      const promise = x.then((val) => {
        this.#setValue(val);
      }, noop);

      return [this.clone(), promise];
    }

    const value = this.#replaceValue(x);

    return isNothing(value) ? none() : some(value);
  }

  take(): Option<T> {
    if (this.isNone()) {
      return none();
    }

    const value = this.#takeValue();
    return isNothing(value) ? none() : some(value);
  }

  takeIf(f: (x: T) => boolean): Option<T> {
    if (this.isNone()) {
      return none();
    }

    try {
      if (f(this.value)) {
        const value = this.#takeValue();
        return isNothing(value) ? none() : some(value);
      }

      return none();
    } catch {
      return none();
    }
  }

  toPendingOption(): PendingOption<T> {
    return pendingOption(this.clone());
  }

  toString(): string {
    return this.isNone() ? "None" : `Some { ${stringify(this.#value)} }`;
  }

  transposeResult<V, E>(this: _Option<Result<V, E>>): Result<Option<V>, E> {
    if (this.isNone() || !isResult(this.value)) {
      return ok(none<V>());
    }

    return this.value.isOk()
      ? ok(some(this.value.value))
      : err(this.value.error);
  }

  transposeAwaitable<V>(
    this: _Option<PromiseLike<V>>,
  ): PendingOption<Awaited<V>> {
    if (this.isNone()) {
      return pendingOption(none());
    }

    return pendingOption(Promise.resolve(this.value).then(some));
  }

  unwrap(): T {
    if (this.isSome()) {
      return this.value;
    }

    throw new AnyError(
      "`unwrap` is called on `None`",
      OptionError.NoneUnwrapped,
    );
  }

  unwrapOr(def: T): T {
    return this.isSome() ? this.value : def;
  }

  unwrapOrElse(mkDef: () => T): T {
    try {
      return this.isSome() ? this.value : mkDef();
    } catch (e) {
      if (e instanceof AnyError) {
        throw e; // if value getter threw => rethrow
      }

      throw mkAnyError(
        "unwrapOrElse callback threw an exception",
        OptionError.PredicateException,
        e,
      );
    }
  }

  xor(y: Option<T>): Option<T>;
  xor(y: Promise<Option<T>>): PendingOption<T>;
  xor(y: MaybePromise<Option<T>>): MaybePendingOption<T> {
    if (isPromise(y)) {
      return this.toPendingOption().xor(y);
    }

    if (this.isNone() && y.isSome()) {
      return some(y.value);
    }

    if (this.isSome() && y.isNone()) {
      return some(this.value);
    }

    return none();
  }

  /**
   * Sets the value of the option.
   */
  #setValue(value: T | Nothing): void {
    this[phantom] = isNothing(value) ? "none" : "some";
    this.#value = value;
  }

  /**
   * Replaces the value of the option with a new one.
   *
   * Returns the old value.
   */
  #replaceValue(newValue: T | Nothing): T | Nothing {
    const oldValue = this.#value;
    this.#setValue(newValue);
    return oldValue;
  }

  /**
   * Takes the value of the option, leaving {@link nothing} in its place.
   *
   * Returns the old value.
   */
  #takeValue(): T | Nothing {
    return this.#replaceValue(nothing);
  }
}
