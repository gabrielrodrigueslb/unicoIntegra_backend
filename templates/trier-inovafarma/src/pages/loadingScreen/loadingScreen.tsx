import { useState, useEffect } from 'react';
import { eventBus } from '@/lib/event-bus'; // Supondo que você tenha o event-bus.ts em lib
import './style.scss';

export default function LoadingScreen() {
  // Estado para guardar a mensagem de status atual
  const [statusMessage, setStatusMessage] = useState('Isso pode demorar alguns minutos.');

  useEffect(() => {
    // A função que será chamada quando um novo status for emitido
    const handleStatusUpdate = (message: string) => {
      setStatusMessage(message);
    };

    // "Inscreva-se" no evento 'loading:status' quando o componente for montado
    eventBus.on('loading:status', handleStatusUpdate);

    // "Cancele a inscrição" quando o componente for desmontado para evitar vazamentos de memória
    return () => {
      eventBus.off('loading:status', handleStatusUpdate);
    };
  }, []); // O array vazio garante que isso rode apenas uma vez (ao montar/desmontar)

  return (
    <>
      <section className="loadingScreen flex items-center justify-center flex-col text-white gap-1 bg-night-navy-blue w-full h-full m-auto min-h-96">
        <span className="img-container loading mb-5">
          <img
            className="loading-circle"
            src="./Eclipse_1x-1.0s-200px-200px.png"
            alt="Carregando..."
          />
        </span>
        <p className='font-bold select-none'>Baixando Dados do estoque</p>
        {/* Este parágrafo agora exibe a mensagem de status dinâmica */}
        <p className="text-xs opacity-75 select-none min-h-[16px] transition-opacity duration-300">
          {statusMessage}
        </p>
      </section>
    </>
  );
}