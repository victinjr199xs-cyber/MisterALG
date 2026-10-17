Algoritmo "media_notas"
// Lê o nome e as duas notas de um aluno e diz se ele foi aprovado.
Var
   nome : caractere
   nota1, nota2, media : real
Inicio
   escreva("Nome do aluno: ")
   leia(nome)
   escreva("Primeira nota: ")
   leia(nota1)
   escreva("Segunda nota: ")
   leia(nota2)
   media <- (nota1 + nota2) / 2
   escreval("Média de ", nome, ": ", media:5:1)
   se media >= 7 entao
      escreval("Situação: APROVADO")
   senao
      se media >= 5 entao
         escreval("Situação: RECUPERAÇÃO")
      senao
         escreval("Situação: REPROVADO")
      fimse
   fimse
Fimalgoritmo
