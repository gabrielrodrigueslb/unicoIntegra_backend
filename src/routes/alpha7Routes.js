import { Router } from "express";

const router = Router()

app.post('/app', async (req, res) => {
  console.log('Requisição de geração recebida com os dados:', req.body);

  const clientData = req.body;
  const buildId = Date.now();
  const buildPath = path.join(__dirname, 'builds-temporarios', `${buildId}`);
  const sourceAppPath = path.join(__dirname, 'app-Alpha7');
  const outputZipPath = path.join(
    __dirname,
    'builds-temporarios',
    `app-cliente-${buildId}.zip`,
  );

  try {
    // 1. Copia a aplicação fonte para uma pasta de build temporária
    console.log(`Copiando app fonte para ${buildPath}`);
    await fs.copy(sourceAppPath, buildPath);

    // 2. Modifica os arquivos de configuração DENTRO da pasta temporária
    console.log('Modificando arquivos de configuração...');
    const dbConfigPath = path.join(buildPath, 'data', 'db-config.json');
    const dbConfig = await fs.readJson(dbConfigPath);
    dbConfig.db.user = clientData.db_user;
    dbConfig.db.host = clientData.db_host;
    dbConfig.db.database = clientData.db_database;
    dbConfig.db.password = clientData.db_password;
    await fs.writeJson(dbConfigPath, dbConfig, { spaces: 4 });

    const accessKeyPath = path.join(buildPath, 'data', 'access_key.json');
    const accessKey = { key: clientData.access_key };
    await fs.writeJson(accessKeyPath, accessKey, { spaces: 4 });

    // 3. Executa o 'pkg' para criar os executáveis dentro da pasta de build
    console.log("Executando o comando 'pkg'...");
    const pkgCommand = [
      `cd ${buildPath}`,
      'npm install',
      'npx pkg . --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --output app-cliente',
    ].join(' && ');

    await new Promise((resolve, reject) => {
      exec(
        pkgCommand,
        { /* shell: 'cmd.exe', */ timeout: 300000 },
        (error, stdout, stderr) => {
          console.log('--- Saída do Processo (stdout) ---');
          console.log(stdout);
          console.log('--- Saída de Erro do Processo (stderr) ---');
          console.log(stderr);
          if (error) {
            return reject(
              new Error(
                `Falha ao executar o pkg. Mensagem: ${error.message}. Stderr: ${
                  stderr || 'vazio'
                }`,
              ),
            );
          }
          console.log("Comando 'pkg' executado com sucesso.");
          resolve(stdout);
        },
      );
    });

    // 4. Cria o arquivo ZIP com todos os arquivos do projeto modificado
    console.log(`Criando arquivo ZIP em ${outputZipPath}`);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputZipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => {
        console.log(
          `ZIP criado com sucesso. Total de bytes: ${archive.pointer()}`,
        );
        resolve();
      });
      archive.on('error', (err) => reject(err));
      archive.pipe(output);

      // ALTERAÇÃO: Adiciona a pasta de build dentro de uma pasta raiz no ZIP
      archive.directory(buildPath, 'app-Alpha7-configurado');

      archive.finalize();
    });

    // 5. Envia o ZIP para download e limpa os arquivos APÓS o envio
    res.download(
      outputZipPath,
      `app-cliente-${clientData.nome_cliente || buildId}.zip`,
      async (err) => {
        if (err) {
          console.error('Erro ao enviar o arquivo para o cliente:', err);
        } else {
          console.log('Arquivo ZIP enviado com sucesso para o cliente.');
        }

        // Limpeza é feita aqui, DENTRO do callback do download.
        console.log('Iniciando limpeza dos arquivos temporários...');
        await rimraf(buildPath); // Apaga a pasta de build inteira
        console.log('Limpeza concluída.');
      },
    );
  } catch (error) {
    console.error('Ocorreu um erro no processo de geração:', error);
    if (await fs.pathExists(buildPath)) {
      console.log(`Limpando pasta de build após erro: ${buildPath}`);
      await rimraf(buildPath);
    }
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: 'Falha na geração', error: error.message });
    }
  }
});

export default router;