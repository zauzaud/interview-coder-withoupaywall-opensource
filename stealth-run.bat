@echo off
echo === Auxiliar de Codigo - Edicao Invisivel (Sem Paywall) ===
echo.
echo IMPORTANTE: Este aplicativo eh projetado para ser INVISIVEL por padrao!
echo Use os atalhos de teclado para controla-lo:
echo.
echo - Alternar Visibilidade: Ctrl+B (ou Cmd+B no Mac)
echo - Tirar Screenshot: Ctrl+H
echo - Processar Screenshots: Ctrl+Enter
echo - Mover Janela: Ctrl+Arrows (Left/Right/Up/Down)
echo - Ajustar Opacidade: Ctrl+[ (diminuir) / Ctrl+] (aumentar)
echo - Resetar Visualizacao: Ctrl+R
echo - Sair do Aplicativo: Ctrl+Q
echo.
echo Quando voce pressionar Ctrl+B, a janela alternara entre visivel e invisivel.
echo Se os atalhos de movimento nao estao funcionando, tente torna-la visivel primeiro com Ctrl+B.
echo.

cd /D "%~dp0"

echo === Passo 1: Criando diretorios necessarios... ===
mkdir "%APPDATA%\interview-coder-v1\temp" 2>nul
mkdir "%APPDATA%\interview-coder-v1\cache" 2>nul
mkdir "%APPDATA%\interview-coder-v1\screenshots" 2>nul
mkdir "%APPDATA%\interview-coder-v1\extra_screenshots" 2>nul

echo === Passo 2: Limpando builds anteriores... ===
echo Removendo arquivos de builds anteriores para garantir um inicio limpo...
rmdir /s /q dist dist-electron 2>nul
del /q .env 2>nul

echo === Passo 3: Construindo o aplicativo... ===
echo Isso pode levar um momento...
call npm run build

echo === Passo 4: Iniciando no modo invisivel... ===
echo Lembre-se: Pressione Ctrl+B para torna-lo visivel, Ctrl+[ e Ctrl+] para ajustar a opacidade!
echo.
set NODE_ENV=production
start /B cmd /c "npx electron ./dist-electron/main.js"

echo O aplicativo esta agora em execucao invisivelmente! Pressione Ctrl+B para torna-lo visivel.
echo.
echo Se voce encontrar algum problema:
echo 1. Certifique-se de ter instalado as dependencias com npm install
echo 2. Pressione Ctrl+B varias vezes para alternar a visibilidade
echo 3. Verifique o Gerenciador de Tarefas para verificar se o aplicativo esta em execucao