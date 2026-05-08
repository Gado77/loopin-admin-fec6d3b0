import { fetchAndParseRSS } from './utils/parseRSS.ts';
import { cleanNewsText } from './utils/cleanText.ts';
import { generateNewsWithAi } from './utils/geminiApi.ts';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FEEDS = [
  "https://g1.globo.com/rss/g1/",
  "https://rss.uol.com.br/feed/noticias.xml"
];

async function main() {
    const supabase = createClient(
        process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!
    );
    for (const feed of FEEDS) {
        console.log(`▶️  Processando feed: ${feed}`);
        const items = await fetchAndParseRSS(feed);
        // Teste: processar apenas 3 itens para validar a pausa
        const limitedItems = items.slice(0, 3);
        console.log(`  ⚡ Modo Teste: processando apenas 3 itens`);

        for (const item of limitedItems) {
            const cleaned = cleanNewsText(`${item.rawTitle ?? ""}. ${item.rawDescription ?? ""} ${item.content ?? ""}`);
            const shortText = cleaned.slice(0, 150);
            const ai = await generateNewsWithAi(shortText, process.env.GEMINI_API_KEY!);
            if (!ai || !ai.title || !ai.description) {
              console.log('  ⚠️  IA retornou vazio ou resposta inválida, pulando notícia.');
              continue;
            }

            // Validação do conteúdo
            if (
                ai.title.length > 120 ||
                ai.description.length > 250 ||
                /foto|imagem|créditos?|\.jpg|\.png/i.test(ai.title + ai.description)
            ) {
              console.log('  ⚠️  Validação falhou: conteúdo muito longo/lixo, pulando notícia.');
              continue;
            }

            // Expires em 6h
            const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
            const { error } = await supabase.from('news').insert({
                source: feed,
                title: ai.title,
                description: ai.description,
                image: item.image,
                priority: 1,
                active: true,
                expires_at: expires,
            });
            if (error) {
              console.error('  ❌ Erro ao salvar:', error);
            } else {
              console.log('  ✅ Notícia salva:', ai.title);
            }
            // Pausa de 15s para respeitar o limite da API gratuita (5 RPM)
            console.log('  ⏳ Aguardando 15s para a próxima...');
            await sleep(15000);
        }
    }
}

main().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1);});
