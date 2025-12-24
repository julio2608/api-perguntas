const express = require('express');
const cors = require('cors');
const fs = require('fs');
const readline = require('readline');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// garante que o body parser use UTF-8
app.use(express.json({ type: 'application/json', limit: '5mb' }));

const API_KEY = 'SUA_CHAVE_SECRETA_AQUI';
const ARQUIVO_PERGUNTAS = './perguntas.json';

// Middleware de autenticação
app.use((req, res, next) => {
  const chave = req.headers['x-api-key'];
  if (chave && chave === API_KEY) return next();
  res.status(403).json({ erro: 'Chave inválida' });
});

// adicionar header com charset para todas respostas JSON
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Ler perguntas do arquivo (uma linha por pergunta) com encoding utf8
async function lerPerguntas() {
  const perguntas = [];
  if (!fs.existsSync(ARQUIVO_PERGUNTAS)) return perguntas;

  // cria stream com encoding utf8
  const fileStream = fs.createReadStream(ARQUIVO_PERGUNTAS, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (let line of rl) {
    if (!line) continue;
    // remove BOM caso exista e trim
    line = line.replace(/^\uFEFF/, '').trim();
    if (!line) continue;
    try {
      perguntas.push(JSON.parse(line));
    } catch (e) {
      console.error('Linha inválida no JSONL (pulando):', line);
    }
  }
  return perguntas;
}

// GET /perguntas
app.get('/perguntas', async (req, res) => {
  try {
    const perguntas = await lerPerguntas();
    // envia como JSON (o header com charset já foi setado)
    res.json(perguntas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao ler perguntas' });
  }
});

// POST /perguntas (single)
app.post('/perguntas', async (req, res) => {
  const { categoria, pergunta, opcoes, resposta, explicacao = null, imagem = null } = req.body;
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
    explicacao,
    imagem
  };

  // append com encoding utf8
  fs.appendFileSync(ARQUIVO_PERGUNTAS, JSON.stringify(novaPergunta) + '\n', { encoding: 'utf8' });
  res.status(201).json(novaPergunta);
});

// POST /perguntas/bulk — recebe várias perguntas em JSONL
app.post('/perguntas/bulk', async (req, res) => {
  try {
    const texto = req.body.texto;
    if (!texto || typeof texto !== "string") {
      return res.status(400).json({ erro: "Envie um campo 'texto' contendo perguntas JSON (uma por linha)." });
    }

    const linhas = texto.split(/\r?\n/).map(l => l.replace(/^\uFEFF/, '').trim()).filter(Boolean);
    const perguntasNovas = [];

    for (const linha of linhas) {
      try {
        const obj = JSON.parse(linha);
        if (!obj.categoria || !obj.pergunta || !obj.opcoes || !obj.resposta) {
          return res.status(400).json({ erro: "Uma das linhas contém campos inválidos." });
        }
        perguntasNovas.push(obj);
      } catch (e) {
        return res.status(400).json({ erro: `Linha inválida: ${linha}` });
      }
    }

    // grava todas as linhas no arquivo em utf8
    const conteudo = perguntasNovas.map(p => JSON.stringify(p)).join("\n") + "\n";
    fs.appendFileSync(ARQUIVO_PERGUNTAS, conteudo, { encoding: 'utf8' });

    res.status(201).json({
      mensagem: `Foram adicionadas ${perguntasNovas.length} perguntas.`,
      totalInserido: perguntasNovas.length
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro interno ao processar bulk insert." });
  }
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
