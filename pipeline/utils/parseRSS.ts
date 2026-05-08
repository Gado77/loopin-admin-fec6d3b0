import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

export async function fetchAndParseRSS(url: string) {
    const res = await fetch(url, { timeout: 10000 });
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    // Focado em RSS 2.0 com 'item'
    const items = parsed.rss?.channel?.item || [];
    return items.map((item: any) => ({
        rawTitle: item.title,
        rawDescription: item.description,
        content: item['content:encoded'] || "",
        image: item['media:content']?.['@_url']
            || (item.description && /<img .*?src=["']([^"']+)/.exec(item.description)?.[1])
            || null,
        published_at: item.pubDate,
        source: url
    }));
}
