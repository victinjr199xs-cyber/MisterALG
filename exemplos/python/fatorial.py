# Recursive factorial: n! = n * (n-1)!
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


n = 5
print(n, "! =", factorial(n))
