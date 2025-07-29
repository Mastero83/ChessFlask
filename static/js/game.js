// Game and status related functions
var game = new Chess();
var statusEl = $('#status');
var fenEl = $('#fen');
var pgnEl = $('#pgn');
var navIndex = null;

function setStatus(status) {
  document.getElementById("status").innerHTML = status;
}

function updateStatus() {
  var status = '';
  var moveColor = game.turn() === 'b' ? 'Black' : 'White';
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  } else if (game.in_draw()) {
    status = 'Game over, drawn position';
  } else {
    status = moveColor + ' to move';
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check';
    }
  }
  setStatus(status);
  getLastCapture();
  createTable();
  updateScroll();

  statusEl.html(status);
  fenEl.html(game.fen());
  pgnEl.html(game.pgn());

  navIndex = null;
  safeBoardPosition(game.fen());

  var winner = null;
  var reason = null;
  if (game.in_checkmate()) {
    winner = game.turn() === 'b' ? 'White' : 'Black';
    reason = 'Checkmate';
  } else if (game.in_draw()) {
    winner = null;
    reason = 'Draw';
  }
  if (game.game_over()) {
    var moves = game.history().length;
    showGameOverOverlay(winner, moves, reason);
  }
}

function takeBack() {
  var history = game.history();
  if (history.length === 0) {
    return;
  } else if (history.length === 1) {
    game.undo();
  } else {
    game.undo();
    game.undo();
  }
  safeBoardPosition(game.fen());
  updateStatus();
}

function newGame() {
  game.reset();
  board.orientation(playerColor);
  if (playMode === 'analysis') {
    safeBoardPosition(game.fen());
    updateStatus();
    return;
  }
  if (playerColor === 'black') {
    updateStatus();
    setTimeout(function() {
      if (playMode !== 'analysis') {
        getResponseMove();
        setTimeout(function() {
          safeBoardPosition(game.fen());
          updateStatus();
        }, 400);
      }
    }, 300);
  } else {
    board.orientation('white');
    safeBoardPosition(game.fen());
    updateStatus();
  }
}

function showGameOverOverlay(winner, moves, reason) {
  var title = '';
  if (winner) {
    title = winner + ' wins!';
  } else {
    title = 'Draw!';
  }
  if (reason) {
    title += ' (' + reason + ')';
  }
  $('#gameOverTitle').text(title);
  $('#gameOverMoves').text('Total moves played: ' + moves);
  $.ajax({
    url: '/analyze_game/',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ pgn: game.pgn(), depth: 5 }),
    success: function(res) {
      var evals = res.evals;
      var summary = classifyMovesWithEvalsByColor(evals);
      var moveTypes = [ 'Brilliant', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder' ];
      var html = '';
      html += '<table class="table table-bordered"><tbody>';
      for (var i = 0; i < moveTypes.length; i++) {
        var key = moveTypes[i];
        html += '<tr><td>' + key + '</td><td>' + (summary.white[key] || 0) + '</td><td>' + (summary.black[key] || 0) + '</td></tr>';
      }
      html += '</tbody></table>';
      $('#gameSummaryTableWrapper').html(html);
    },
    error: function() {
      $('#gameSummaryTableWrapper').html('<div style="color:#d32f2f;">Analysis failed.</div>');
    }
  });
  $('#gameOverOverlay').fadeIn(400);
  startFireworks();
}

function hideGameOverOverlay() {
  $('#gameOverOverlay').fadeOut(200);
  stopFireworks();
}
