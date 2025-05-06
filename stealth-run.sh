#!/bin/bash
echo "=== Auxiliar de Código - Edição Invisível (Sem Paywall) ==="
echo
echo "IMPORTANTE: Este aplicativo é projetado para ser INVISÍVEL por padrão!"
echo "Use os atalhos de teclado para controlá-lo:"
echo
echo "- Alternar Visibilidade: Cmd+B"
echo "- Tirar Screenshot: Cmd+H"
echo "- Processar Screenshots: Cmd+Enter"
echo "- Mover Janela: Cmd+Arrows (Left/Right/Up/Down)"
echo "- Ajustar Opacidade: Cmd+[ (diminuir) / Cmd+] (aumentar)"
echo "- Resetar Visualização: Cmd+R"
echo "- Sair do Aplicativo: Cmd+Q"
echo
echo "Quando você pressionar Cmd+B, a janela alternará entre visível e invisível."
echo "Se os atalhos de movimento não estão funcionando, tente torná-la visível primeiro com Cmd+B."
echo

# Navigate to script directory
cd "$(dirname "$0")"

echo "=== Passo 1: Criando diretórios necessários... ==="
mkdir -p ~/Library/Application\ Support/interview-coder-v1/temp
mkdir -p ~/Library/Application\ Support/interview-coder-v1/cache
mkdir -p ~/Library/Application\ Support/interview-coder-v1/screenshots
mkdir -p ~/Library/Application\ Support/interview-coder-v1/extra_screenshots

echo "=== Passo 2: Limpando builds anteriores... ==="
echo "Removendo arquivos de builds anteriores para garantir um início limpo..."
rm -rf dist dist-electron
rm -f .env

echo "=== Passo 3: Construindo o aplicativo... ==="
echo "Isso pode levar um momento..."
npm run build

echo "=== Passo 4: Iniciando no modo invisível... ==="
echo "Lembre-se: Pressione Cmd+B para torná-lo visível, Cmd+[ e Cmd+] para ajustar a opacidade!"
echo
export NODE_ENV=production
npx electron ./dist-electron/main.js &

echo "O aplicativo está agora em execução invisivelmente! Pressione Cmd+B para torná-lo visível."
echo
echo "Se você encontrar algum problema:"
echo "1. Certifique-se de ter instalado as dependências com 'npm install'"
echo "2. Certifique-se de que este script tem permissões de execução (chmod +x stealth-run.sh)"
echo "3. Pressione Cmd+B várias vezes para alternar a visibilidade"
echo "4. Verifique o Activity Monitor para verificar se o aplicativo está em execução"
