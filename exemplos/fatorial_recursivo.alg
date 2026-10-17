Algoritmo "fatorial_recursivo"
// Calcula o fatorial com uma função que chama a si mesma.
// Experimente rodar com F8 e abrir a Pilha de ativação (Ctrl+F3).
Var
   n : inteiro

Funcao fatorial(x : inteiro) : inteiro
Inicio
   se x <= 1 entao
      retorne 1
   fimse
   retorne x * fatorial(x - 1)
Fimfuncao

Inicio
   escreva("Calcular o fatorial de: ")
   leia(n)
   escreval(n, "! =", fatorial(n))
Fimalgoritmo
