export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8">
      <h1 className="text-4xl font-bold text-[var(--color-secondary)]">
        Preventiva Propostas IA
      </h1>
      <p className="text-lg text-[var(--color-text-main)]">
        Sistema de geração de propostas comerciais.
      </p>
      <a
        href="/dashboard"
        className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        Acessar Sistema
      </a>
    </div>
  );
}
