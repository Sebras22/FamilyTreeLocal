use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

const LIBRARY_FILE: &str = "library.arbora";
const BACKUP_FILE: &str = "library.arbora.bak";
const TEMP_FILE: &str = "library.arbora.tmp";

#[cfg(unix)]
fn create_private_dir(dir: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::DirBuilderExt;
    fs::DirBuilder::new().recursive(true).mode(0o700).create(dir)
}

#[cfg(not(unix))]
fn create_private_dir(dir: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dir)
}

fn private_options() -> OpenOptions {
    let mut options = OpenOptions::new();
    options.write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options
}

fn read_in(dir: &Path) -> Result<Option<String>, String> {
    let path = dir.join(LIBRARY_FILE);
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!(
            "Impossible de lire la bibliothèque ({}) : {e}",
            path.display()
        )),
    }
}

fn write_in(dir: &Path, data: &str) -> Result<(), String> {
    create_private_dir(dir).map_err(|e| {
        format!(
            "Impossible de créer le dossier de données ({}) : {e}",
            dir.display()
        )
    })?;

    let target = dir.join(LIBRARY_FILE);
    let backup = dir.join(BACKUP_FILE);
    let temp = dir.join(TEMP_FILE);

    let write_temp = || -> std::io::Result<()> {
        let mut file = private_options().create(true).truncate(true).open(&temp)?;
        file.write_all(data.as_bytes())?;
        file.sync_all()
    };
    if let Err(e) = write_temp() {
        let _ = fs::remove_file(&temp);
        return Err(format!(
            "Impossible d'écrire la bibliothèque (fichier temporaire {}) : {e}",
            temp.display()
        ));
    }

    if target.exists() {
        if let Err(e) = fs::copy(&target, &backup) {
            let _ = fs::remove_file(&temp);
            return Err(format!(
                "Impossible de sauvegarder l'ancienne version ({}) : {e}",
                backup.display()
            ));
        }
    }

    if let Err(e) = fs::rename(&temp, &target) {
        let _ = fs::remove_file(&temp);
        return Err(format!(
            "Impossible de finaliser l'enregistrement ({}) : {e}",
            target.display()
        ));
    }

    sync_dir(dir);
    Ok(())
}

fn backup_in(dir: &Path, data: &str) -> Result<PathBuf, String> {
    create_private_dir(dir).map_err(|e| {
        format!(
            "Impossible de créer le dossier de données ({}) : {e}",
            dir.display()
        )
    })?;
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    for attempt in 0..100u32 {
        let name = if attempt == 0 {
            format!("{LIBRARY_FILE}.illisible-{seconds}")
        } else {
            format!("{LIBRARY_FILE}.illisible-{seconds}-{attempt}")
        };
        let path = dir.join(name);
        match private_options().create_new(true).open(&path) {
            Ok(mut file) => {
                let written: std::io::Result<()> = file
                    .write_all(data.as_bytes())
                    .and_then(|_| File::sync_all(&file));
                return written.map(|_| path.clone()).map_err(|e| {
                    format!("Impossible d'écrire la copie ({}) : {e}", path.display())
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => {
                return Err(format!(
                    "Impossible de créer la copie ({}) : {e}",
                    path.display()
                ))
            }
        }
    }
    Err("Impossible de trouver un nom libre pour la copie".to_string())
}

#[cfg(unix)]
fn sync_dir(dir: &Path) {
    if let Ok(d) = fs::File::open(dir) {
        let _ = d.sync_all();
    }
}

#[cfg(not(unix))]
fn sync_dir(_dir: &Path) {}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Dossier de données de l'application introuvable : {e}"))
}

#[tauri::command]
fn read_library(app: tauri::AppHandle) -> Result<Option<String>, String> {
    read_in(&data_dir(&app)?)
}

#[tauri::command]
fn write_library(app: tauri::AppHandle, data: String) -> Result<(), String> {
    write_in(&data_dir(&app)?, &data)
}

#[tauri::command]
fn backup_library(app: tauri::AppHandle, data: String) -> Result<String, String> {
    backup_in(&data_dir(&app)?, &data).map(|path| path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_library, write_library, backup_library])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Arbora");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("arbora-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn lecture_sans_fichier_renvoie_none() {
        let dir = temp_dir("none");
        assert_eq!(read_in(&dir), Ok(None));
    }

    #[test]
    fn ecriture_cree_le_dossier_et_relit() {
        let dir = temp_dir("create").join("sous").join("dossier");
        write_in(&dir, "{\"a\":1}").unwrap();
        assert_eq!(read_in(&dir), Ok(Some("{\"a\":1}".to_string())));
        assert!(!dir.join(TEMP_FILE).exists());
        assert!(!dir.join(BACKUP_FILE).exists());
        let _ = fs::remove_dir_all(dir.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn ecriture_conserve_l_ancienne_version_en_bak() {
        let dir = temp_dir("bak");
        write_in(&dir, "v1 é").unwrap();
        write_in(&dir, "v2").unwrap();
        assert_eq!(read_in(&dir), Ok(Some("v2".to_string())));
        assert_eq!(fs::read_to_string(dir.join(BACKUP_FILE)).unwrap(), "v1 é");
        write_in(&dir, "v3").unwrap();
        assert_eq!(fs::read_to_string(dir.join(BACKUP_FILE)).unwrap(), "v2");
        assert!(!dir.join(TEMP_FILE).exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn copie_d_un_fichier_illisible_n_ecrase_jamais() {
        let dir = temp_dir("illisible");
        let first = backup_in(&dir, "corrompu 1").unwrap();
        let second = backup_in(&dir, "corrompu 2").unwrap();
        assert_ne!(first, second);
        assert_eq!(fs::read_to_string(&first).unwrap(), "corrompu 1");
        assert_eq!(fs::read_to_string(&second).unwrap(), "corrompu 2");
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn fichiers_et_dossier_sont_prives() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("prive");
        write_in(&dir, "v1").unwrap();
        write_in(&dir, "v2").unwrap();
        let mode = |p: PathBuf| fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(dir.clone()), 0o700);
        assert_eq!(mode(dir.join(LIBRARY_FILE)), 0o600);
        assert_eq!(mode(dir.join(BACKUP_FILE)), 0o600);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn erreur_lisible_si_le_dossier_est_un_fichier() {
        let base = temp_dir("err");
        fs::create_dir_all(&base).unwrap();
        let fichier = base.join("occupe");
        fs::write(&fichier, "x").unwrap();
        let err = write_in(&fichier, "data").unwrap_err();
        assert!(err.starts_with("Impossible"), "{err}");
        let _ = fs::remove_dir_all(base);
    }
}
