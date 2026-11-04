// MV-01 a MV-03 y la extensión EXT-MV-U01 (actualizar venta, fuera del ERS) — responsable: Persona B (Ignacio).
// Página provisional: reemplazar EnConstruccion por la pantalla real.
import { EnConstruccion } from '../../shared/ui/componentes.jsx';

export default function AdminVentas() {
  return (
    <EnConstruccion
      titulo="Ventas"
      requerimientos="MV-01 a MV-03 y la extensión EXT-MV-U01 (actualizar venta, fuera del ERS)"
      responsable="Persona B (Ignacio)"
    />
  );
}
