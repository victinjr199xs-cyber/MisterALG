Algoritmo "cadastro_registro"
// Usa um registro (tipo) para guardar os dados de 3 produtos.
Const
   MAX = 3
Tipo
   produto = registro
      nome : caractere
      preco : real
      estoque : inteiro
   fimregistro
Var
   itens : vetor[1..MAX] de produto
   i : inteiro
   total : real
Inicio
   para i de 1 ate MAX faca
      escreval("Produto ", i)
      escreva("  nome: ")
      leia(itens[i].nome)
      escreva("  preço: ")
      leia(itens[i].preco)
      escreva("  estoque: ")
      leia(itens[i].estoque)
   fimpara
   total <- 0
   para i de 1 ate MAX faca
      total <- total + itens[i].preco * itens[i].estoque
   fimpara
   escreval("Valor total em estoque: R$", total:10:2)
Fimalgoritmo
