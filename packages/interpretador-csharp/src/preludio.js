// A parte da biblioteca do .NET que é mais simples escrever em C# do que em JavaScript: as exceções,
// as interfaces e os enums. O app lê este texto com o tree-sitter junto com o programa do aluno.

export const PRELUDIO = `
namespace System {
  public class Exception {
    protected string _mensagem;
    protected Exception _interna;
    public Exception() { }
    public Exception(string message) { _mensagem = message; }
    public Exception(string message, Exception innerException) { _mensagem = message; _interna = innerException; }
    public virtual string Message => _mensagem ?? ("Exception of type '" + GetType().FullName + "' was thrown.");
    public Exception InnerException => _interna;
    public virtual string StackTrace => "";
    public string Source { get; set; }
    public int HResult { get; set; }
    public virtual string ToString() { return GetType().FullName + ": " + Message; }
    public Exception GetBaseException() { Exception e = this; while (e.InnerException != null) e = e.InnerException; return e; }
  }
  public class SystemException : Exception {
    public SystemException() { }
    public SystemException(string message) : base(message) { }
    public SystemException(string message, Exception innerException) : base(message, innerException) { }
  }
  public class ApplicationException : Exception {
    public ApplicationException() { }
    public ApplicationException(string message) : base(message) { }
    public ApplicationException(string message, Exception innerException) : base(message, innerException) { }
  }
  public class ArgumentException : SystemException {
    protected string _param;
    public ArgumentException() { }
    public ArgumentException(string message) : base(message) { }
    public ArgumentException(string message, string paramName) : base(message) { _param = paramName; }
    public ArgumentException(string message, Exception innerException) : base(message, innerException) { }
    public virtual string ParamName => _param;
    public override string Message => base.Message + (_param != null ? " (Parameter '" + _param + "')" : "");
  }
  public class ArgumentNullException : ArgumentException {
    public ArgumentNullException() : base("Value cannot be null.") { }
    public ArgumentNullException(string paramName) : base("Value cannot be null.", paramName) { }
    public ArgumentNullException(string paramName, string message) : base(message, paramName) { }
  }
  public class ArgumentOutOfRangeException : ArgumentException {
    public ArgumentOutOfRangeException() : base("Specified argument was out of the range of valid values.") { }
    public ArgumentOutOfRangeException(string paramName) : base("Specified argument was out of the range of valid values.", paramName) { }
    public ArgumentOutOfRangeException(string paramName, string message) : base(message, paramName) { }
  }
  public class ArithmeticException : SystemException {
    public ArithmeticException() : base("Overflow or underflow in the arithmetic operation.") { }
    public ArithmeticException(string message) : base(message) { }
  }
  public class DivideByZeroException : ArithmeticException {
    public DivideByZeroException() : base("Attempted to divide by zero.") { }
    public DivideByZeroException(string message) : base(message) { }
  }
  public class OverflowException : ArithmeticException {
    public OverflowException() : base("Arithmetic operation resulted in an overflow.") { }
    public OverflowException(string message) : base(message) { }
  }
  public class FormatException : SystemException {
    public FormatException() : base("One of the identified items was in an invalid format.") { }
    public FormatException(string message) : base(message) { }
  }
  public class IndexOutOfRangeException : SystemException {
    public IndexOutOfRangeException() : base("Index was outside the bounds of the array.") { }
    public IndexOutOfRangeException(string message) : base(message) { }
  }
  public class InvalidCastException : SystemException {
    public InvalidCastException() : base("Specified cast is not valid.") { }
    public InvalidCastException(string message) : base(message) { }
  }
  public class InvalidOperationException : SystemException {
    public InvalidOperationException() : base("Operation is not valid due to the current state of the object.") { }
    public InvalidOperationException(string message) : base(message) { }
    public InvalidOperationException(string message, Exception innerException) : base(message, innerException) { }
  }
  public class ObjectDisposedException : InvalidOperationException {
    public ObjectDisposedException(string objectName) : base("Cannot access a disposed object. Object name: '" + objectName + "'.") { }
  }
  public class NotImplementedException : SystemException {
    public NotImplementedException() : base("The method or operation is not implemented.") { }
    public NotImplementedException(string message) : base(message) { }
  }
  public class NotSupportedException : SystemException {
    public NotSupportedException() : base("Specified method is not supported.") { }
    public NotSupportedException(string message) : base(message) { }
  }
  public class PlatformNotSupportedException : NotSupportedException {
    public PlatformNotSupportedException() : base("Operation is not supported on this platform.") { }
  }
  public class NullReferenceException : SystemException {
    public NullReferenceException() : base("Object reference not set to an instance of an object.") { }
    public NullReferenceException(string message) : base(message) { }
  }
  public class OutOfMemoryException : SystemException {
    public OutOfMemoryException() : base("Insufficient memory to continue the execution of the program.") { }
  }
  public class StackOverflowException : SystemException {
    public StackOverflowException() : base("Operation caused a stack overflow.") { }
  }
  public class InsufficientExecutionStackException : SystemException {
    public InsufficientExecutionStackException() : base("Insufficient stack to continue executing the program safely.") { }
    public InsufficientExecutionStackException(string message) : base(message) { }
  }
  public class TimeoutException : SystemException {
    public TimeoutException() : base("The operation has timed out.") { }
    public TimeoutException(string message) : base(message) { }
  }
  public class UnauthorizedAccessException : SystemException {
    public UnauthorizedAccessException() : base("Attempted to perform an unauthorized operation.") { }
    public UnauthorizedAccessException(string message) : base(message) { }
  }
  public class RankException : SystemException {
    public RankException() : base("Attempted to operate on an array with the incorrect number of dimensions.") { }
  }
  public class ArrayTypeMismatchException : SystemException {
    public ArrayTypeMismatchException() : base("Attempted to access an element as a type incompatible with the array.") { }
  }
  public class OperationCanceledException : SystemException {
    public OperationCanceledException() : base("The operation was canceled.") { }
    public OperationCanceledException(string message) : base(message) { }
  }
  public class AggregateException : Exception {
    public AggregateException(string message) : base(message) { }
    public AggregateException(string message, Exception innerException) : base(message, innerException) { }
  }
  public class SwitchExpressionException : InvalidOperationException {
    public SwitchExpressionException() : base("Non-exhaustive switch expression failed to match its input.") { }
  }
}
namespace System.IO {
  public class IOException : SystemException {
    public IOException() : base("I/O error occurred.") { }
    public IOException(string message) : base(message) { }
  }
  public class FileNotFoundException : IOException {
    public FileNotFoundException() : base("Unable to find the specified file.") { }
    public FileNotFoundException(string message) : base(message) { }
  }
  public class DirectoryNotFoundException : IOException {
    public DirectoryNotFoundException() : base("Could not find a part of the path.") { }
    public DirectoryNotFoundException(string message) : base(message) { }
  }
  public class EndOfStreamException : IOException {
    public EndOfStreamException() : base("Unable to read beyond the end of the stream.") { }
  }
}
namespace System.Collections.Generic {
  public class KeyNotFoundException : SystemException {
    public KeyNotFoundException() : base("The given key was not present in the dictionary.") { }
    public KeyNotFoundException(string message) : base(message) { }
  }
  public struct KeyValuePair {
    public object Key;
    public object Value;
    public KeyValuePair(object key, object value) { Key = key; Value = value; }
    public void Deconstruct(out object key, out object value) { key = Key; value = Value; }
    public override string ToString() { return "[" + Key + ", " + Value + "]"; }
  }
}
namespace System.Threading.Tasks {
  public class TaskCanceledException : OperationCanceledException {
    public TaskCanceledException() : base("A task was canceled.") { }
  }
}
namespace System {
  public class EventArgs { public static readonly EventArgs Empty = new EventArgs(); }
  public delegate void EventHandler(object sender, EventArgs e);
  public interface IDisposable { void Dispose(); }
  public interface IComparable { int CompareTo(object other); }
  public interface IEquatable { bool Equals(object other); }
  public interface ICloneable { object Clone(); }
  public interface IFormattable { }
  public interface IEnumerable { }
  public interface IEnumerator { }
  public interface IComparer { }
  public interface IEqualityComparer { }
  public interface ICollection { }
  public interface IList { }
  public interface IDictionary { }
  public interface IReadOnlyList { }
  public interface IReadOnlyCollection { }
  public interface IReadOnlyDictionary { }
  public interface IAsyncDisposable { }
  public enum StringComparison { CurrentCulture, CurrentCultureIgnoreCase, InvariantCulture, InvariantCultureIgnoreCase, Ordinal, OrdinalIgnoreCase }
  public enum StringSplitOptions { None = 0, RemoveEmptyEntries = 1, TrimEntries = 2 }
  public enum MidpointRounding { ToEven = 0, AwayFromZero = 1, ToZero = 2, ToNegativeInfinity = 3, ToPositiveInfinity = 4 }
  [Flags] public enum NumberStyles { None = 0, AllowLeadingWhite = 1, AllowTrailingWhite = 2, AllowLeadingSign = 4, AllowTrailingSign = 8, AllowParentheses = 16, AllowDecimalPoint = 32, AllowThousands = 64, AllowExponent = 128, AllowCurrencySymbol = 256, Integer = 7, Number = 111, Float = 167, Currency = 383, Any = 511 }
  public enum DayOfWeek { Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday }
  public enum DateTimeKind { Unspecified, Utc, Local }
  public enum ConsoleColor { Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta, DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta, Yellow, White }
  public enum ConsoleKey { Backspace = 8, Tab = 9, Enter = 13, Escape = 27, Spacebar = 32, LeftArrow = 37, UpArrow = 38, RightArrow = 39, DownArrow = 40, A = 65, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z }
  [Flags] public enum AttributeTargets { All = 32767 }
}
`
