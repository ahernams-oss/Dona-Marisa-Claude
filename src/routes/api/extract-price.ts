import { createFileRoute } from "@tanstack/react-router";

// Este endpoint fala com um gateway de chat completions no formato OpenAI
// (`{ model, messages, response_format }` -> `{ choices: [{ message: { content } }] }`).
// Por padrão aponta para o gateway de IA do Lovable Cloud, mas qualquer provedor
// compatível com esse formato (OpenRouter, endpoint próprio, etc.) funciona só
// trocando as env vars abaixo — sem tocar neste arquivo.
const AI_GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY || process.env.LOVABLE_API_KEY;
const AI_GATEWAY_MODEL_PRIMARY = process.env.AI_GATEWAY_MODEL_PRIMARY || "google/gemini-3-flash-preview";
const AI_GATEWAY_MODEL_FALLBACK = process.env.AI_GATEWAY_MODEL_FALLBACK || "google/gemini-2.5-flash";

export const Route = createFileRoute("/api/extract-price")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = AI_GATEWAY_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing AI_GATEWAY_API_KEY" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { image } = (await request.json()) as { image?: string };
        if (!image || !image.startsWith("data:image")) {
          return new Response(JSON.stringify({ error: "Imagem inválida" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const systemPrompt = `Você é um assistente especialista em extração de dados (OCR) de etiquetas de preço de supermercados brasileiros (como Mundial, Guanabara, Zona Sul, Pão de Açúcar, etc.).
Sua tarefa é analisar a imagem fornecida e extrair as informações necessárias com extrema precisão.

### REGRAS DE EXTRAÇÃO:
1. **Nome do Produto (product_name)**:
   - Extraia o nome completo e claro do produto (ex: "ARROZ TIO JOÃO PARBOILIZADO 1KG").
   - Mantenha informações cruciais como peso/volume (ex: "1KG", "900G", "500G") se estiverem presentes no texto da etiqueta.
   - Remova códigos internos, barras ou textos de aviso que não pertençam ao nome do produto.

2. **Marca (brand)**:
   - Identifique a marca do produto (ex: "Tio João", "Bom Gosto", "Tio Mingote", "Alemao").
   - Se a marca for mencionada no nome do produto ou logo da embalagem que aparece na imagem, extraia-a. Se não conseguir identificar, retorne null.

3. **Preço (price)**:
   - Procure pelo preço de venda atual (o valor que o cliente paga no caixa).
   - **IMPORTANTE (Preço Promocional)**: Se houver preço regular ("DE") e promocional ("POR" ou "App"), escolha SEMPRE o preço promocional (o menor preço/valor final pago).
   - **IMPORTANTE (Centavos Sobrescritos)**: Em etiquetas brasileiras, os centavos costumam aparecer em tamanho muito menor ou sobrescrito (ex: o número "3" grande e um "73" menor acima). Junte-os corretamente (ex: 3 e 73 vira o número decimal 3.73).
   - Retorne o preço estritamente como um número decimal (ex: 3.73 ou 17.80). Nunca inclua cifrões (R$), letras ou texto.

4. **Unidade de Medida (unit)**:
   - Identifique a unidade de venda com base nas opções: "un" (para unidade/unidade de venda individual), "kg", "g", "L", "ml".
   - Se na etiqueta constar "Unidade", "UN", "UND" ou similar, converta para "un".

### DIRETRIZES DE SAÍDA:
Responda APENAS com um objeto JSON válido no seguinte formato:
{
  "product_name": "string",
  "brand": "string|null",
  "price": number,
  "unit": "un" | "kg" | "g" | "L" | "ml"
}

Se a imagem estiver totalmente ilegível, borrada ou não contiver uma etiqueta de preço visível, responda exatamente:
{"error": "unreadable"}`;

        const callModel = async (model: string) =>
          fetch(AI_GATEWAY_BASE_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Leia esta etiqueta de preço de supermercado brasileiro com atenção aos centavos sobrescritos e devolva estritamente o JSON pedido.",
                    },
                    { type: "image_url", image_url: { url: image } },
                  ],
                },
              ],
              response_format: { type: "json_object" },
            }),
          });

        try {
          let upstream = await callModel(AI_GATEWAY_MODEL_PRIMARY);

          // Fallback para modelo estável se o preview falhar por erro transitório
          if (!upstream.ok && upstream.status >= 500) {
            upstream = await callModel(AI_GATEWAY_MODEL_FALLBACK);
          }

          if (!upstream.ok) {
            const txt = await upstream.text();
            if (upstream.status === 429) {
              return new Response(JSON.stringify({ error: "Muitas leituras agora. Aguarde alguns segundos e tente novamente." }), { status: 429, headers: { "Content-Type": "application/json" } });
            }
            if (upstream.status === 402) {
              return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace para continuar." }), { status: 402, headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ error: "Falha ao contatar a IA", detail: txt }), { status: 502, headers: { "Content-Type": "application/json" } });
          }

          const json = await upstream.json();
          const content = json?.choices?.[0]?.message?.content ?? "{}";
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(content);
          } catch {
            parsed = { error: "unreadable" };
          }
          return new Response(JSON.stringify(parsed), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
