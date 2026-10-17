Algoritmo "adivinhe_numero"
// O computador sorteia um número de 1 a 50; você tenta adivinhar.
Var
   secreto, palpite, tentativas : inteiro
Inicio
   secreto <- randi(50) + 1
   tentativas <- 0
   repita
      escreva("Seu palpite (1 a 50): ")
      leia(palpite)
      tentativas <- tentativas + 1
      escolha palpite
      caso secreto
         escreval("Acertou em ", tentativas, " tentativa(s)!")
      outrocaso
         se palpite < secreto entao
            escreval("É maior.")
         senao
            escreval("É menor.")
         fimse
      fimescolha
   ate palpite = secreto
Fimalgoritmo
