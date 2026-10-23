// Provedores do Assistente de IA (usados pelo main, que faz as chamadas, e pela
// janela de configuração do renderer). Os nomes de modelo são só o padrão: o
// usuário pode trocar, porque cada provedor lança modelos novos o tempo todo.

export const PROVEDORES = [
  { id: 'claude', nome: 'Claude (Anthropic)', modelo: 'claude-opus-5-5', chave: true, site: 'https://platform.claude.com' },
  { id: 'openai', nome: 'ChatGPT / Codex (OpenAI)', modelo: 'gpt-5-mini', url: 'https://api.openai.com/v1', chave: true, site: 'https://platform.openai.com' },
  { id: 'deepseek', nome: 'DeepSeek', modelo: 'deepseek-chat', url: 'https://api.deepseek.com', chave: true, site: 'https://platform.deepseek.com' },
  { id: 'gemini', nome: 'Gemini (Google)', modelo: 'gemini-2.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai', chave: true, site: 'https://aistudio.google.com' },
  { id: 'ollama', nome: 'Ollama (roda no seu computador, grátis)', modelo: 'llama3.2', url: 'http://localhost:11434/v1', chave: false, site: 'https://ollama.com' },
  { id: 'outro', nome: 'Outro compatível com OpenAI (OpenRouter, Groq, LM Studio…)', modelo: '', url: '', chave: true },
]

export const provedorPorId = (id) => PROVEDORES.find((p) => p.id === id) ?? PROVEDORES[0]

/**
 * Separa um trecho de Server-Sent Events nos campos `data:` completos.
 * @returns {{dados: string[], resto: string}} `resto` é a linha incompleta, para juntar ao próximo trecho
 */
export function separarSSE(buffer) {
  const linhas = buffer.split(/\r?\n/)
  const resto = linhas.pop()
  const dados = linhas.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter((d) => d && d !== '[DONE]')
  return { dados, resto }
}
