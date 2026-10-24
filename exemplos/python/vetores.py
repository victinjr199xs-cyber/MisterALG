v = [4, 8, 15, 16, 23]
soma = 0

# Sum all elements with a loop
for i in range(len(v)):
    soma += v[i]

print("Sum:", soma)
print("Average: {:.2f}".format(soma / len(v)))
