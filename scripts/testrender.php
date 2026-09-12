<?php
define('CLI_SCRIPT', true);
require('config.php');
$c = $DB->get_record('course', ['id' => 1]);
$PAGE->set_course($c);
$PAGE->set_url(new moodle_url('/course/view.php', ['id' => $c->id]));

$icons = ['i/settings', 'i/grades', 'i/marker', 't/edit', 'i/completion_auto_pass', 'i/checked'];
foreach ($icons as $i) {
    echo $i . ": " . $OUTPUT->render(new pix_icon($i, $i, 'core')) . "\n";
}
