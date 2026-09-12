<?php
define('CLI_SCRIPT', true);
require('config.php');
echo get_class($OUTPUT) . "\n";
echo $OUTPUT->heading('Test', 1);
