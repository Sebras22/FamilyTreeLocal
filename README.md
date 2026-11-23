# Arbora (version locale)

Application de bureau de généalogie, **100 % hors ligne** : aucun compte, aucune télémétrie, aucune requête réseau. Interface React / TypeScript / Vite / Mantine, emballée avec Tauri 2.

Vos données restent sur votre machine, dans un seul fichier `library.arbora` (plus une copie de la version précédente, `library.arbora.bak`). L'écriture est atomique : fichier temporaire, synchronisation disque, puis renommage.

Emplacement du dossier de données (identifiant `app.arbora.local`, dossier `app_data_dir` de Tauri) :

| Système | Dossier |
| --- | --- |
| Windows | `%APPDATA%\app.arbora.local\` |
| macOS | `~/Library/Application Support/app.arbora.local/` |
| Linux | `~/.local/share/app.arbora.local/` |

Ces chemins sont ceux attendus d'après la convention de Tauri.

Pensez à sauvegarder ce fichier vous-même : il n'y a pas de synchronisation.

## Développement

```bash
npm install
npm run tauri:dev     # fenêtre Tauri + Vite sur http://localhost:5173 (port fixe)
npm run tauri:build   # installateurs dans src-tauri/target/release/bundle/
npm test              # tests unitaires (Vitest), dont le format .arbora
cd src-tauri && cargo test   # tests de lecture/écriture atomique
```

### Prérequis

- **Windows** : Node, Rust, outils de build MSVC (Visual Studio Build Tools, charge « Développement Desktop en C++ ») et WebView2 (présent sur Windows 11).
- **Linux (Debian/Ubuntu)** : `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev libxdo-dev build-essential`.
- **macOS** : Xcode Command Line Tools (`xcode-select --install`).

### Icônes

Aucun logo en fichier n'existait (le logo est un composant SVG dans `src/shared/theme/design.tsx`). Une icône provisoire reprenant ce dessin (feuille blanche à l'arbre sur un disque rose, fond transparent aux coins) a été générée en `src-tauri/app-icon.png` (1024x1024), puis déclinée avec `npx tauri icon src-tauri/app-icon.png`. Remplacez ce PNG par un vrai logo et relancez la commande pour régénérer les icônes.

## Installer (utilisateur final)

Les installateurs sont **non signés** pour l'instant.

- **Windows** : `Arbora_0.1.0_x64-setup.exe` (NSIS, installation pour l'utilisateur courant) ou le `.msi`. Windows SmartScreen affichera « Windows a protégé votre ordinateur » : cliquez sur **Informations complémentaires** puis **Exécuter quand même**. Ce message est normal pour un installateur sans signature ; il n'existe pas d'autre moyen légitime de le contourner.
- **Linux** : `AppImage` (`chmod +x` puis lancer) ou paquet `.deb`.
- **macOS** : le build est **non signé et non notarisé** (pas d'abonnement développeur Apple) et il est désactivé par défaut dans la CI. Gatekeeper refusera l'ouverture normale ; il faut autoriser l'app manuellement (clic droit > Ouvrir, ou Réglages Système > Confidentialité et sécurité > « Ouvrir quand même »), et la marche à suivre varie selon la version de macOS. Ce chemin n'a pas été testé. Sur Mac, la version web/PWA reste l'alternative.

## Paquet MSIX (Microsoft Store)

```bash
npm run msix -- -IdentityName "<Package/Identity/Name>" -Publisher "<Package/Identity/Publisher>" -PublisherDisplayName "<nom de l'éditeur>"
```

Les trois valeurs viennent du Partner Center (page « Product identity » de l'application réservée). Le script compile l'application, prépare `msix/staging/` (exécutable, icônes, `AppxManifest.xml`) et produit `msix/out/Arbora_<version>_x64.msix` avec `makeappx` (SDK Windows requis). Ce paquet, non signé, se dépose tel quel dans une soumission : le Store le signe.

Pour tester l'installation sur votre machine, ajoutez `-Sign` : le script crée un certificat auto-signé (`msix/out/Arbora-test.cer`, aussi ajouté au magasin personnel de l'utilisateur) et signe le paquet. Il faut ensuite approuver ce certificat en administrateur (magasin « Personnes autorisées » de l'ordinateur local) avant `Add-AppxPackage`. Ce chemin d'installation n'a pas été testé.

La version du paquet est celle de `tauri.conf.json` suivie de `.0` (le Store impose une quatrième partie à 0). La capacité `runFullTrust` est déclarée et doit être justifiée dans la soumission (application de bureau Win32).

Dans un paquet MSIX, Windows redirige `%APPDATA%` vers un dossier privé du paquet : `library.arbora` n'est plus dans `%APPDATA%\app.arbora.local\` et **sa désinstallation supprime les données**. Le bouton d'export de la bibliothèque est alors la seule sauvegarde fiable.

## Ce qui est vérifié

Sur Windows 11 : `cargo check`, `cargo test` (4 tests), génération du NSIS (2,5 Mio) et du MSI (3 Mio), lancement de l'exécutable release (fenêtre « Arbora »). Linux et macOS ne sont construits que par la CI (`.github/workflows/release.yml`, déclenchée par un tag `v*`), jamais exécutée à ce jour.

## Sécurité

CSP stricte (`default-src 'self'`, images `self`/`data:`/`blob:`, pas de connexion externe), aucun plugin Tauri, capacités vides : seules les commandes propres `read_library` et `write_library` sont exposées. Les outils de développement ne sont pas disponibles en release.

## Feuille de route de distribution (non faite)

- **Microsoft Store (MSIX)** : le Store signe gratuitement le MSIX. Tauri ne produit pas de MSIX nativement ; il faudra l'outillage `winapp` de Microsoft ou `makeappx` à partir de l'exécutable construit.
- **Flatpak** pour Linux.
- **Mises à jour** : plugin updater de Tauri avec une clé de signature propre. Non activé : l'application n'a actuellement aucun accès réseau.
