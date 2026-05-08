export function cleanNewsText(text: string): string {
    if (!text) return "";
    return text
        .replace(/<[^>]*>/g, " ") // HTML
        .replace(/&[^;\s]+;/g, " ") // entidades
        .replace(/https?:\/\/\S+/g, " ") // URLs
        .replace(/\b(foto|imagem|créditos?|reprodução|divulgação):?/gi, " ")
        .replace(/\w+\.(jpg|png|jpeg|gif)\b/gi, " ")
        .replace(/\b[A-Z][a-z]+\/[A-Za-z0-9]+/g, " ") // Nome/Agência
        .replace(/\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}
