<?php
/**
 * Plugin Name: Catastrophes Naturelles Mondiales
 * Plugin URI: https://github.com/alertesmeteo-hub/catastrophes-mondiales
 * Description: Carte interactive mondiale des catastrophes naturelles récentes (séismes USGS, feux, tempêtes, volcans, inondations NASA EONET).
 * Version: 1.0.2
 * Author: Alertes Météo Hub
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CNM_VERSION', '1.0.2');
define('CNM_RELEASE_DATE', '04/09/2026');
define('CNM_OPTION_DATA_URL', 'cnm_data_url');
define(
    'CNM_DEFAULT_DATA_URL',
    'https://raw.githubusercontent.com/alertesmeteo-hub/catastrophes-mondiales/data/disasters.json'
);

add_action('wp_enqueue_scripts', 'cnm_register_assets');
add_action('admin_init', 'cnm_register_settings');
add_action('admin_menu', 'cnm_add_settings_page');
add_shortcode('catastrophes_mondiales', 'cnm_render_shortcode');
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'cnm_plugin_action_links');

function cnm_plugin_action_links($links) {
    $settings_link = sprintf(
        '<a href="%s">%s</a>',
        esc_url(admin_url('options-general.php?page=catastrophes-mondiales')),
        esc_html__('Réglages', 'catastrophes-mondiales')
    );
    array_unshift($links, $settings_link);

    $help_link = sprintf(
        '<a href="%s">%s</a>',
        esc_url(admin_url('options-general.php?page=catastrophes-mondiales')),
        esc_html__('Shortcodes / Aide', 'catastrophes-mondiales')
    );
    array_unshift($links, $help_link);

    return $links;
}

function cnm_register_assets() {
    wp_register_style(
        'cnm-leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        array(),
        '1.9.4'
    );
    wp_register_script(
        'cnm-leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        array(),
        '1.9.4',
        true
    );
    wp_register_style(
        'cnm-map',
        plugin_dir_url(__FILE__) . 'assets/cnm-map.css',
        array('cnm-leaflet'),
        CNM_VERSION
    );
    wp_register_script(
        'cnm-map',
        plugin_dir_url(__FILE__) . 'assets/cnm-map.js',
        array('cnm-leaflet'),
        CNM_VERSION,
        true
    );
}

function cnm_register_settings() {
    register_setting(
        'cnm_settings',
        CNM_OPTION_DATA_URL,
        array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => CNM_DEFAULT_DATA_URL,
        )
    );

    add_settings_section(
        'cnm_main_section',
        'Source des données',
        '__return_false',
        'catastrophes-mondiales'
    );

    add_settings_field(
        'cnm_data_url_field',
        'Adresse du fichier disasters.json',
        'cnm_render_url_field',
        'catastrophes-mondiales',
        'cnm_main_section'
    );
}

function cnm_render_url_field() {
    $value = get_option(CNM_OPTION_DATA_URL, CNM_DEFAULT_DATA_URL);
    printf(
        '<input type="url" class="regular-text code" name="%1$s" value="%2$s" autocomplete="off">',
        esc_attr(CNM_OPTION_DATA_URL),
        esc_attr($value)
    );
    echo '<p class="description">Conservez l’adresse proposée : elle pointe vers la branche « data » du dépôt Catastrophes Naturelles Mondiales.</p>';
}

function cnm_add_settings_page() {
    add_options_page(
        'Catastrophes Naturelles Mondiales',
        'Catastrophes Mondiales',
        'manage_options',
        'catastrophes-mondiales',
        'cnm_render_settings_page'
    );
}

function cnm_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Catastrophes Naturelles Mondiales</h1>
        <form action="options.php" method="post">
            <?php
            settings_fields('cnm_settings');
            do_settings_sections('catastrophes-mondiales');
            submit_button();
            ?>
        </form>
        <p><strong>Version du module : <?php echo esc_html(CNM_VERSION); ?> (<?php echo esc_html(CNM_RELEASE_DATE); ?>)</strong></p>
        <h2>Shortcode unique</h2>
        <p><code>[catastrophes_mondiales]</code> : carte mondiale interactive (séismes, feux, tempêtes, volcans, inondations…).</p>
        <p><code>[catastrophes_mondiales hauteur="700" titre="Catastrophes naturelles en cours" categorie="seisme,feu"]</code></p>
        <h2>Sources</h2>
        <p>
            Séismes : <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">USGS Earthquake Hazards Program</a> (magnitude ≥ 4,5, 7 derniers jours).<br>
            Autres événements : <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA EONET</a> (feux, tempêtes, volcans, inondations, sécheresses, glace, glissements de terrain).
        </p>
        <p>Actualisation automatique toutes les 3 heures via GitHub Actions.</p>
    </div>
    <?php
}

function cnm_data_url() {
    return esc_url_raw(get_option(CNM_OPTION_DATA_URL, CNM_DEFAULT_DATA_URL));
}

function cnm_render_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'hauteur' => '650',
            'titre' => 'Catastrophes naturelles dans le monde',
            'categorie' => '',
        ),
        $atts,
        'catastrophes_mondiales'
    );

    $height = max(400, min(1200, absint($atts['hauteur'])));
    $title = trim(sanitize_text_field($atts['titre']));
    if ($title === '') {
        $title = 'Catastrophes naturelles dans le monde';
    }
    $categories = array_filter(array_map('sanitize_key', explode(',', $atts['categorie'])));
    $map_id = function_exists('wp_unique_id')
        ? wp_unique_id('cnm-map-')
        : 'cnm-map-' . wp_rand(1000, 999999);

    wp_enqueue_style('cnm-leaflet');
    wp_enqueue_style('cnm-map');
    wp_enqueue_script('cnm-leaflet');
    wp_enqueue_script('cnm-map');

    ob_start();
    ?>
    <section
        id="<?php echo esc_attr($map_id); ?>"
        class="cnm-card"
        data-cnm-app
        data-data-url="<?php echo esc_url(cnm_data_url()); ?>"
        data-categories="<?php echo esc_attr(implode(',', $categories)); ?>"
        data-module-version="<?php echo esc_attr(CNM_VERSION); ?>"
        style="--cnm-height: <?php echo esc_attr($height); ?>px"
    >
        <header class="cnm-header">
            <div>
                <p class="cnm-kicker">SÉISMES • FEUX • TEMPÊTES • VOLCANS • INONDATIONS — TEMPS QUASI RÉEL</p>
                <h2><?php echo esc_html($title); ?></h2>
                <p class="cnm-meta" data-cnm-updated>Chargement des données…</p>
            </div>
            <div class="cnm-badge">MONDE<br><strong>3h</strong></div>
        </header>

        <div class="cnm-toolbar" data-cnm-toolbar aria-label="Filtrer par catégorie"></div>

        <div class="cnm-viewport">
            <div class="cnm-map" data-cnm-map role="img" aria-label="Carte mondiale des catastrophes naturelles"></div>
            <button type="button" class="cnm-fullscreen-btn" data-cnm-fullscreen title="Plein écran" aria-label="Basculer en plein écran">⛶</button>
            <a class="cnm-map-brand" href="https://www.alertes-meteo.com/" target="_blank" rel="noopener noreferrer">
                www.alertes-meteo.com • Module v<?php echo esc_html(CNM_VERSION); ?> (<?php echo esc_html(CNM_RELEASE_DATE); ?>)
            </a>
            <div class="cnm-loading" data-cnm-loading role="status">Chargement de la carte…</div>
            <div class="cnm-error" data-cnm-error role="alert" hidden></div>
        </div>

        <footer class="cnm-footer">
            <span data-cnm-count>—</span>
            <span>
                Données :
                <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">USGS</a>
                • <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA EONET</a>
                • <a href="https://www.alertes-meteo.com/" target="_blank" rel="noopener noreferrer">www.alertes-meteo.com</a>
                • Module v<?php echo esc_html(CNM_VERSION); ?> (<?php echo esc_html(CNM_RELEASE_DATE); ?>)
            </span>
        </footer>

        <noscript>
            <p class="cnm-message cnm-error-message">JavaScript doit être activé pour afficher la carte.</p>
        </noscript>
    </section>
    <?php
    return ob_get_clean();
}
