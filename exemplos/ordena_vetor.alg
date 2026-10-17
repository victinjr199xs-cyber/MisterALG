Algoritmo "ordena_vetor"
// Ordena um vetor com o método da bolha (bubble sort).
// O procedimento troca recebe os elementos por referência (var).
Var
   v : vetor[1..6] de inteiro
   i, j : inteiro

Procedimento troca(var a, b : inteiro)
Var
   aux : inteiro
Inicio
   aux <- a
   a <- b
   b <- aux
Fimprocedimento

Inicio
   v[1] <- 42
   v[2] <- 7
   v[3] <- 19
   v[4] <- 3
   v[5] <- 25
   v[6] <- 11
   para i de 1 ate 5 faca
      para j de 1 ate 6 - i faca
         se v[j] > v[j + 1] entao
            troca(v[j], v[j + 1])
         fimse
      fimpara
   fimpara
   escreva("Ordenado:")
   para i de 1 ate 6 faca
      escreva(v[i])
   fimpara
   escreval
Fimalgoritmo
