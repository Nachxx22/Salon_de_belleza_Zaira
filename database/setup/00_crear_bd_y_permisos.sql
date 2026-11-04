/* =============================================================================
   00_crear_bd_y_permisos.sql — Se ejecuta UNA vez por computadora
   -----------------------------------------------------------------------------
   Ábrelo en SQL Server Management Studio conectado como administrador
   (autenticación de Windows) y ejecútalo después de cambiar los dos valores
   de abajo. Crea la base de datos de desarrollo y le da permisos al login SQL
   de desarrollo que usa el backend.

   - El login SQL de desarrollo (el mismo de Base de Datos 1) ya debe existir
     en la instancia. Si no existe, descomenta el bloque "Crear el login" y pon
     la contraseña solo en tu copia local. NO subas credenciales a GitHub:
     cambia los valores al ejecutarlo, pero no hagas commit de ese cambio.
   - Repite el script cambiando @BaseDatos si necesitas otra base, por ejemplo
     ZairaIntegracion en la computadora de la demostración.
============================================================================= */

DECLARE @BaseDatos SYSNAME = N'ZairaDev_B';   -- ZairaDev_A, ZairaDev_B o ZairaIntegracion
DECLARE @Login     SYSNAME = N'TU_LOGIN_SQL'; -- login SQL de desarrollo

/* Crear el login (solo si todavía no existe):
IF SUSER_ID(@Login) IS NULL
    EXEC (N'CREATE LOGIN ' + QUOTENAME(@Login) + N' WITH PASSWORD = N''CAMBIAR_AQUI'', CHECK_POLICY = OFF;');
*/

IF DB_ID(@BaseDatos) IS NULL
    EXEC (N'CREATE DATABASE ' + QUOTENAME(@BaseDatos) + N';');

DECLARE @sql NVARCHAR(MAX) = N'
USE ' + QUOTENAME(@BaseDatos) + N';
IF USER_ID(N''' + REPLACE(@Login, N'''', N'''''') + N''') IS NULL
    CREATE USER ' + QUOTENAME(@Login) + N' FOR LOGIN ' + QUOTENAME(@Login) + N';
ALTER ROLE db_owner ADD MEMBER ' + QUOTENAME(@Login) + N';';
EXEC (@sql);

PRINT N'Listo: la base ' + @BaseDatos + N' existe y el login ' + @Login + N' tiene permisos db_owner.';
