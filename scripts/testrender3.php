<?php
define('CLI_SCRIPT', true);
require('config.php');

$data = [
    'custom_nodes' => [
        [
            'key' => 'settings',
            'url' => '#',
            'text' => 'Settings',
            'isactive' => false,
            'iconhtml' => '<i class="fa fa-cog"></i>',
            'haschildren' => true,
            'children' => [
                ['url' => '#', 'text' => 'Child', 'isactive' => false]
            ]
        ]
    ]
];
echo $OUTPUT->render_from_template('theme_boost_union/secondary_icons_vertical', $data);
