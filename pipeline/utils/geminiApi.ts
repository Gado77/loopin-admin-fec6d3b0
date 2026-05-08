import fetch from 'node-fetch';

export async function generateNewsWithAi(baseText: string, apiKey: string): Promise<{title: string, description: string} | null> {
    const prompt = `Você é um curador de notícias para painéis de TV em locais públicos (comércio, salas de espera) na cidade de São José do Piauí - PI.

Sua tarefa é filtrar e resumir notícias. Siga ESTAS REGRAS RIGOROSAS:

REGRAS DE FILTRAGEM — DESCARTE a notícia se:
1. For violência extrema: estupro, assassinato cruel, tortura, necropsia, perícia criminal
2. For conteúdo sexual explícito ou assédio grave
3. For notícia hiperlocal de OUTRA região (ex: "TV Bahia", "RJ Perícia", "Polícia de SP") que não tenha relevância nacional
4. For fofoca de celebridade, escândalo pessoal, ou conteúdo irrelevante
5. For sobre trânsito/acidente local sem impacto geral

REGRAS DE RESUMO — Se a notícia PASSAR no filtro:
- Gere um título (máx 10 palavras) e descrição (máx 30 palavras)
- Frases completas, diretas, em português do Brasil
- Não copie frases originais, reescreva com suas palavras
- Não cite imagens, créditos, ou metadados
- Não invente fatos que não estão no texto original

Se a notícia NÃO PASSAR no filtro, responda EXATAMENTE: {"skip": true}

Se PASSAR, responda neste formato:
{"title": "...", "description": "..."}

Conteúdo: """${baseText}"""
Responda somente em JSON válido.`;
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Erro API Gemini (${res.status}): ${errorText}`);
        return null;
    }

    const data = await res.json();
    const output = (data?.candidates?.[0]?.content?.parts?.[0]?.text||"")
        .replace(/```json/g, "").replace(/```/g,"").trim();
    try {
        const json = JSON.parse(output);
        if (json.skip === true) {
            console.log('  ⏭️  Notícia filtrada pela IA');
            return null;
        }
        return json;
    } catch (e) {
        console.log('\x1b[33m[DEBUG Gemini IA] Output bruto:', output, '\x1b[0m');
        return null;
    }
}
