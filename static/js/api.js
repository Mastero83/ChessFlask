// API communication functions
function randomResponse() {
  var fen = game.fen();
  $.get('/move/' + depth + '/' + encodeURIComponent(fen) + '/', function(data) {
    game.move(data, {sloppy: true});
    updateStatus();
  });
}

function getResponseMove() {
  var slider = document.getElementById("engineDepthSlider");
  var depth = slider ? slider.value : 2;
  var fen = game.fen();
  var engineSettings = getEngineSettings();
  $.get('/move/' + depth + '/' + encodeURIComponent(fen) + '/', { engine_settings: engineSettings }, function(data) {
    var move = game.move(data, {sloppy: true});
    playMoveSound(move && !!move.captured);
    updateStatus();
    setTimeout(function(){ safeBoardPosition(game.fen()); }, 100);
  });
}

function fetchAndShowCheatMoves() {
  var depth = cheatDepth;
  var fen = game.fen();
  $.get('/cheat_moves/' + depth + '/' + encodeURIComponent(fen) + '/', function(moves) {
    updateCheatsMovesList(moves);
  });
}

function fetchEvalAndUpdateBar() {
  if (!document.getElementById('toggleEvalBar')?.checked) return;
  var fen = game.fen();
  $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
    updateEvalBar(score);
  });
}
