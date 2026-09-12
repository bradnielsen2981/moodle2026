<?php
define('CLI_SCRIPT', true);
require('config.php');

$c = clone $PAGE;
$c->set_url(new moodle_url('/admin/search.php'));
echo $c->pagelayout;
