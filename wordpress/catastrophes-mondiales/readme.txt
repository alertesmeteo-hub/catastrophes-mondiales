=== Catastrophes Naturelles Mondiales ===
Contributors: alertesmeteo
Tags: catastrophes, seismes, meteo, eonet, usgs, avada
Requires at least: 5.8
Requires PHP: 7.4
Stable tag: 1.2.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Carte interactive mondiale des catastrophes naturelles récentes (séismes, feux, tempêtes, volcans, inondations…).

== Description ==

Le shortcode [catastrophes_mondiales] affiche une carte mondiale interactive :

* séismes de magnitude ≥ 4,5 sur les 7 derniers jours (USGS Earthquake Hazards Program) ;
* feux de forêt, tempêtes, volcans, inondations, sécheresses, glace, glissements de
  terrain, neige, températures extrêmes (NASA EONET, événements ouverts, 20 derniers jours) ;
* filtres par catégorie, infobulles avec détails et lien vers la source ;
* actualisation automatique toutes les 3 heures via GitHub Actions.

Paramètres du shortcode :

* `hauteur` : hauteur de la carte en pixels (défaut 650) ;
* `titre` : titre affiché au-dessus de la carte ;
* `categorie` : liste de catégories séparées par des virgules pour restreindre
  l'affichage (ex. `categorie="seisme,feu"`).

Les données sont lues depuis la branche data du dépôt GitHub configuré dans
Réglages > Catastrophes Mondiales.

== Changelog ==

= 1.0.0 =
* Version initiale : séismes USGS + événements NASA EONET, carte Leaflet, filtres par catégorie.
