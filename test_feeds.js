const feeds = {
  economia: "https://g1.globo.com/rss/g1/economia/",
  saude:    "https://g1.globo.com/rss/g1/ciencia-e-saude/",
  tecnologia: "https://g1.globo.com/rss/g1/tecnologia/",
  esportes: "https://ge.globo.com/rss/ge/"
};

async function testFeeds() {
  for (const [key, url] of Object.entries(feeds)) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`Feed ${key}: ${res.status} - length: ${text.length}`);
      const itemsMatch = text.match(/<item>/g);
      console.log(`  Items found: ${itemsMatch ? itemsMatch.length : 0}`);
    } catch (e) {
      console.error(`Feed ${key} failed:`, e.message);
    }
  }
}
testFeeds();
