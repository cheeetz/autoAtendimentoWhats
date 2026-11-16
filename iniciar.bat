@echo off
rem Inicia o bot e reinicia sozinho se ele parar.
rem Para iniciar junto com o Windows, veja a secao "Deixar rodando sozinho" do MANUAL.md.
cd /d "%~dp0"
:inicio
call npm start
echo.
echo O bot parou. Reiniciando em 10 segundos... (feche esta janela para encerrar)
timeout /t 10 /nobreak >nul
goto inicio
