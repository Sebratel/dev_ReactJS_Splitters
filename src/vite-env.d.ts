/// <reference types="vite/client" />

// Traz os tipos de `import.meta.env` e as declarações de módulo dos assets que o Vite
// resolve (`.css`, `.svg`, imagens). Sem este ficheiro o `tsc -b` acusa 66 erros —
// `Property 'env' does not exist on type 'ImportMeta'` e `Cannot find module './index.css'` —
// em qualquer sistema operativo.
//
// É o ficheiro que o template do Vite gera e que aqui nunca chegou a ser versionado, porque
// o `.gitignore` ignorava `**/*.d.ts` sem excepção. Ver a excepção `!src/**/*.d.ts` lá.
