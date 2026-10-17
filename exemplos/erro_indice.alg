Algoritmo "erro_indice"
// Exemplo de ERRO proposital: o vetor vai de 1 a 5, mas o laço vai até 6.
// Rode (F9) para ver a mensagem; depois troque o 6 por 5 e rode de novo.
Var
   v : vetor[1..5] de inteiro
   i : inteiro
Inicio
   para i de 1 ate 6 faca
      v[i] <- i * 10
   fimpara
   escreval("Preenchido!")
Fimalgoritmo
