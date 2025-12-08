const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const API_KEY = 'SUA_CHAVE_SECRETA_AQUI';
const ARQUIVO_PERGUNTAS = './perguntas.json';

// Middleware de autenticação
app.use((req, res, next) => {
  const chave = req.headers['x-api-key'];
  if (chave && chave === API_KEY) next();
  else res.status(403).json({ erro: 'Chave inválida' });
});

// Ler perguntas do arquivo (uma linha por pergunta)
async function lerPerguntas() {
  const perguntas = [];
  if (!fs.existsSync(ARQUIVO_PERGUNTAS)) return perguntas;
  const fileStream = fs.createReadStream(ARQUIVO_PERGUNTAS);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) perguntas.push(JSON.parse(line));
  }
  return perguntas;
}

// GET /perguntas
app.get('/perguntas', async (req, res) => {
  const perguntas = await lerPerguntas();
  res.json(perguntas);
});

// POST /perguntas
app.post('/perguntas', async (req, res) => {
  const { categoria, pergunta, opcoes, resposta } = req.body;
  if (!categoria || !pergunta || !opcoes || !resposta) {
    return res.status(400).json({ erro: 'Campos inválidos' });
  }
  const perguntas = await lerPerguntas();
  const novaPergunta = {
    id: perguntas.length + 1,
    categoria,
    pergunta,
    opcoes,
    resposta,
  };
  fs.appendFileSync(ARQUIVO_PERGUNTAS, JSON.stringify(novaPergunta) + '\n');
  res.status(201).json(novaPergunta);
});

// POST /perguntas/bulk — recebe várias perguntas em JSONL (melhorado)
app.post('/perguntas/bulk', async (req, res) => {
  try {
    const texto = req.body.texto;
    if (!texto || typeof texto !== "string") {
      return res.status(400).json({ erro: "Envie um campo 'texto' contendo perguntas JSON (uma por linha)." });
    }

    // lê todas perguntas atuais para calcular próximo id
    const perguntasExistentes = await lerPerguntas();
    let proximoId = perguntasExistentes.length ? Math.max(...perguntasExistentes.map(p => Number(p.id) || 0)) + 1 : 1;

    const linhas = texto.split("\n").map(l => l.trim()).filter(Boolean);
    if (linhas.length === 0) return res.status(400).json({ erro: "Nenhuma linha válida encontrada no texto." });

    const perguntasNovas = [];

    for (const linha of linhas) {
      let obj;
      try {
        obj = JSON.parse(linha);
      } catch (e) {
        return res.status(400).json({ erro: `Linha com JSON inválido: ${linha}` });
      }

      // valida campos obrigatórios
      if (!obj.categoria || !obj.pergunta || !obj.opcoes || !obj.resposta) {
        return res.status(400).json({ erro: "Cada linha precisa ter 'categoria', 'pergunta', 'opcoes' e 'resposta'." });
      }

      // valida tipo de opcoes
      if (!Array.isArray(obj.opcoes) || obj.opcoes.length < 2) {
        return res.status(400).json({ erro: "Campo 'opcoes' deve ser um array com ao menos 2 itens." });
      }

      // valida resposta pertence às opções
      if (!obj.opcoes.map(String).includes(String(obj.resposta))) {
        return res.status(400).json({ erro: `A resposta '${obj.resposta}' não está entre as opções: ${JSON.stringify(obj.opcoes)}` });
      }

      // constrói objeto final com id automático
      const nova = {
        id: proximoId++,
        categoria: String(obj.categoria),
        pergunta: String(obj.pergunta),
        opcoes: obj.opcoes.map(String),
        resposta: String(obj.resposta),
        explicacao: obj.explicacao ? String(obj.explicacao) : null,
        imagem: obj.imagem ? String(obj.imagem) : null,
        criadaEm: new Date().toISOString()
      };

      perguntasNovas.push(nova);
    }

    // grava todas as linhas no arquivo (append)
    const conteudo = perguntasNovas.map(p => JSON.stringify(p)).join("\n") + "\n";
    fs.appendFileSync(ARQUIVO_PERGUNTAS, conteudo, "utf8");

    return res.status(201).json({
      mensagem: `Foram adicionadas ${perguntasNovas.length} perguntas.`,
      inseridas: perguntasNovas
    });

  } catch (e) {
    console.error('bulk error:', e);
    return res.status(500).json({ erro: "Erro interno ao processar bulk insert." });
  }
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
