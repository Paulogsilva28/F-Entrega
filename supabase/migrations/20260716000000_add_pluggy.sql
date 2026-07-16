ALTER TABLE public.moto_expenses 
ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.estabelecimentos_moto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid, -- Opcional, se nulo é global para todos os usuários
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('combustivel', 'manutencao')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estabelecimentos_moto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow public select for estabelecimentos_moto" ON public.estabelecimentos_moto
  FOR SELECT USING (true);
CREATE POLICY "own estabelecimentos_moto insert" ON public.estabelecimentos_moto
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own estabelecimentos_moto update" ON public.estabelecimentos_moto
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own estabelecimentos_moto delete" ON public.estabelecimentos_moto
  FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.estabelecimentos_moto (nome, tipo)
VALUES 
  ('POSTO IPIRANGA', 'combustivel'),
  ('POSTO BR', 'combustivel'),
  ('POSTO SHELL', 'combustivel'),
  ('OFICINA DUAS RODAS', 'manutencao'),
  ('MOTOPECAS SILVA', 'manutencao'),
  ('CENTRO AUTOMOTIVO', 'manutencao')
ON CONFLICT (nome) DO NOTHING;
