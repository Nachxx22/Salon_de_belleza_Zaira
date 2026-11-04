// MCA-02 Reprogramar cita y MCA-03 Cancelar cita (Cliente), con código y teléfono — responsable: Persona A.
// Página provisional: reemplazar EnConstruccion por la pantalla real.
import { EnConstruccion } from '../../shared/ui/componentes.jsx';

export default function GestionarCita() {
  return (
    <EnConstruccion
      titulo="Mi cita"
      requerimientos="MCA-02 Reprogramar cita y MCA-03 Cancelar cita (Cliente), con código y teléfono"
      responsable="Persona A"
    />
  );
}
