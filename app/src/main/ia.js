// Assistente de IA (opcional, desligado por padrão). As chamadas saem daqui, do
// processo principal: a chave nunca vai para a página. O Claude usa o SDK oficial;
// os outros provedores falam o formato de chat da OpenAI (/chat/completions).

import Anthropic from '@anthropic-ai/sdk'
import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVEDORES, provedorPorId, separarSSE } from '../compartilhado/ia.js'

const SISTEMA = `Você é o assistente do MisterALG, uma IDE para quem está aprendendo lógica de programação.
A pergunta diz a linguagem: Portugol, C ou C++. O C e o C++ rodam com o clang em WebAssembly: a biblioteca
padrão é completa (com try/catch), e system("pause"/"cls"), conio.h (getch)
e Sleep() funcionam. O Portugol é o do VisuAlg 3.0 (algoritmo, var, inicio, fimalgoritmo, leia, escreva, escreval,
se/entao/senao/fimse, para/de/ate/passo/faca/fimpara, enquanto/faca/fimenquanto, repita/ate,
escolha/caso/outrocaso/fimescolha, procedimento, funcao, vetor[1..n] de tipo, <- para atribuição,
\\ para divisão inteira, % ou mod para o resto). Os números de linha vêm no início de cada linha do código.
Responda sempre em português do Brasil, de forma curta, clara e encorajadora, para um iniciante.
Use blocos \`\`\` para código.`

const MODOS = {
  dica: `MODO DICA (o professor quer que o aluno aprenda fazendo): nunca escreva a solução completa
nem reescreva o algoritmo do aluno. Aponte a linha, explique o conceito envolvido e dê uma pista ou um
exemplo pequeno sobre outro assunto. Se o aluno pedir a resposta pronta, explique gentilmente que no
modo dica você ajuda a chegar lá, e dê o próximo passo.`,
  livre: 'MODO LIVRE: você pode mostrar código corrigido completo quando ajudar.',
}

// ---- chaves (criptografadas pelo sistema: Keychain, DPAPI ou o chaveiro do Linux) ----

const arquivoChaves = () => join(app.getPath('userData'), 'chaves-ia.json')
const naMemoria = {} // se o sistema não tiver criptografia, a chave vale só até fechar o app

function lerChaves() {
  try {
    return JSON.parse(readFileSync(arquivoChaves(), 'utf8'))
  } catch {
    return {}
  }
}

function chaveDe(provedor) {
  const cifrada = lerChaves()[provedor]
  if (cifrada && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(cifrada, 'base64'))
    } catch {
      // chave gravada em outro computador/usuário: pede de novo
    }
  }
  return naMemoria[provedor] ?? null
}

/** Grava (ou apaga, com chave vazia) a chave de um provedor. */
export function gravarChave(provedor, chave) {
  const chaves = lerChaves()
  delete chaves[provedor]
  delete naMemoria[provedor]
  if (chave) {
    if (safeStorage.isEncryptionAvailable()) chaves[provedor] = safeStorage.encryptString(chave).toString('base64')
    else naMemoria[provedor] = chave
  }
  writeFileSync(arquivoChaves(), JSON.stringify(chaves), 'utf8')
}

/** Quais provedores já têm chave (o renderer só fica sabendo disso, nunca da chave). */
export const provedoresComChave = () => Object.fromEntries(PROVEDORES.map((p) => [p.id, !!chaveDe(p.id)]))

// ---- perguntas ---------------------------------------------------------------------

const emAndamento = new Map() // id -> AbortController

export const cancelar = (id) => emAndamento.get(id)?.abort()

/**
 * @param config prefs.ia ({ provedor, modelos, urls, modo })
 * @param mensagens [{ role: 'user'|'assistant', content }]
 * @param aoTexto(pedaco) chamado a cada pedaço da resposta
 * @returns {Promise<{texto?:string, erro?:string, cancelado?:boolean}>}
 */
export async function perguntar(id, config, mensagens, aoTexto) {
  const p = provedorPorId(config.provedor)
  const modelo = config.modelos?.[p.id] || p.modelo
  const url = (config.urls?.[p.id] || p.url || '').replace(/\/+$/, '')
  const chave = chaveDe(p.id)
  if (p.chave && !chave) return { erro: `Falta a chave de API do ${p.nome}. Abra Configurar e cole a chave.` }
  if (!modelo) return { erro: 'Falta o nome do modelo. Abra Configurar e escreva o modelo do provedor.' }
  if (!p.chave || p.id === 'outro') {
    if (!/^https?:\/\//.test(url)) return { erro: 'O endereço do provedor precisa começar com http:// ou https://.' }
  }

  const sistema = `${SISTEMA}\n\n${MODOS[config.modo] ?? MODOS.dica}`
  const controle = new AbortController()
  emAndamento.set(id, controle)
  try {
    const texto = p.id === 'claude'
      ? await perguntarClaude({ chave, modelo, sistema, mensagens, aoTexto, signal: controle.signal })
      : await perguntarCompativel({ url, chave, modelo, sistema, mensagens, aoTexto, signal: controle.signal })
    return { texto }
  } catch (e) {
    if (controle.signal.aborted) return { cancelado: true }
    return { erro: explicarErro(e, p) }
  } finally {
    emAndamento.delete(id)
  }
}

// Modelos que aceitam o "fallback" do servidor: se um filtro de segurança recusar, outro modelo responde.
const ACEITA_FALLBACK = /^claude-(fable-5|opus-5|sonnet-5-5)/

async function perguntarClaude({ chave, modelo, sistema, mensagens, aoTexto, signal }) {
  const cliente = new Anthropic({ apiKey: chave })
  const fluxo = cliente.beta.messages.stream({
    model: modelo,
    max_tokens: 16000,
    system: sistema,
    messages: mensagens,
    ...(ACEITA_FALLBACK.test(modelo) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'medium' } } : {}),
  }, { signal })
  let texto = ''
  fluxo.on('text', (pedaco) => {
    texto += pedaco
    aoTexto(pedaco)
  })
  const final = await fluxo.finalMessage()
  if (final.stop_reason === 'refusal') {
    const aviso = '\n\n(O Claude preferiu não responder a esta pergunta. Tente reformular.)'
    aoTexto(aviso)
    texto += aviso
  } else if (final.stop_reason === 'max_tokens') {
    aoTexto('\n\n(Resposta cortada por ser longa demais.)')
  }
  return texto
}

async function perguntarCompativel({ url, chave, modelo, sistema, mensagens, aoTexto, signal }) {
  const r = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...(chave ? { authorization: `Bearer ${chave}` } : {}) },
    body: JSON.stringify({ model: modelo, stream: true, messages: [{ role: 'system', content: sistema }, ...mensagens] }),
  })
  if (!r.ok) {
    const corpo = await r.text().catch(() => '')
    let msg = corpo.slice(0, 300)
    try {
      msg = JSON.parse(corpo).error?.message ?? msg
    } catch {
      // corpo não é JSON
    }
    throw Object.assign(new Error(msg), { status: r.status })
  }
  let texto = ''
  let resto = ''
  for await (const pedaco of r.body.pipeThrough(new TextDecoderStream())) {
    const lido = separarSSE(resto + pedaco)
    resto = lido.resto
    for (const dado of lido.dados) {
      const json = JSON.parse(dado)
      if (json.error) throw new Error(json.error.message ?? String(json.error))
      const delta = json.choices?.[0]?.delta?.content
      if (delta) {
        texto += delta
        aoTexto(delta)
      }
    }
  }
  return texto
}

function explicarErro(e, p) {
  if (e instanceof Anthropic.AuthenticationError || e.status === 401) return `A chave de API do ${p.nome} foi recusada. Confira se copiou a chave inteira.`
  if (e instanceof Anthropic.PermissionDeniedError || e.status === 403) return `O ${p.nome} negou o acesso: a chave não tem permissão para este modelo, ou a conta está sem crédito.`
  if (e instanceof Anthropic.NotFoundError || e.status === 404) return `O ${p.nome} não encontrou o modelo ou o endereço. Confira o nome do modelo em Configurar.`
  if (e instanceof Anthropic.RateLimitError || e.status === 429) return `Limite de uso do ${p.nome} atingido (ou sem crédito). Espere um pouco e tente de novo.`
  if (e instanceof Anthropic.APIConnectionError || e.cause?.code === 'ECONNREFUSED' || e.cause?.code === 'ENOTFOUND' || e.message === 'fetch failed') {
    return p.id === 'ollama'
      ? 'Não consegui falar com o Ollama. Ele está aberto? (instale em ollama.com e rode "ollama pull llama3.2")'
      : `Não consegui conectar ao ${p.nome}. Verifique a internet.`
  }
  if (e instanceof Anthropic.APIError || e.status) return `O ${p.nome} respondeu com erro ${e.status ?? ''}: ${e.message}`
  return `Erro inesperado: ${e.message}`
}
