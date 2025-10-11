import axios from 'axios';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3.1:free';

async function generarResumenComentarios(comentariosTexto) {
    try {
        const prompt = `
Resumí los siguientes comentarios de usuarios sobre una cabaña en un camping. 
Usá un tono neutral, mencioná los aspectos positivos y negativos en 2 o 3 oraciones máximo.
El resumen servira para mostrarlo publicamente en la cabaña.
Evita titulos como "resumen de comentarios", ve directo al resumen.

Comentarios:
${comentariosTexto}
`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: process.env.OPENROUTER_MODEL,
                messages: [
                    { role: 'user', content: prompt }
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'X-Title': 'Camping Cachi',
                }
            }
        );

        const resumen = response.data?.choices?.[0]?.message?.content?.trim() || null;
        return resumen;
    } catch (error) {
        console.error('Error al generar resumen con OpenRouter:', error?.response?.data || error.message);
        return null;
    }
}

export default { generarResumenComentarios };
