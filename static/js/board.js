// Board related logic
var board;
var selectedSquare = null;
var legalDests = [];

function onDragStart(source, piece, position, orientation) {
  if (game.game_over() === true ||
      (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onDrop(source, target) {
  if (playMode !== 'analysis' && playerColor === 'black' && game.turn() === 'w') {
    return 'snapback';
  }
  if (playMode !== 'analysis' && playerColor === 'white' && game.turn() === 'b') {
    return 'snapback';
  }
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  });
  if (move === null) return 'snapback';
  playMoveSound(!!move.captured);
  updateStatus();
  if (playMode !== 'analysis') {
    getResponseMove();
  }
  removeHighlights();
}

function onSnapEnd() {
  safeBoardPosition(game.fen());
}

function highlightSquares(from, to) {
  removeHighlights();
  var fromSq = $('[data-square="' + from + '"]');
  var toSq = $('[data-square="' + to + '"]');
  fromSq.addClass('highlight-from');
  toSq.addClass('highlight-to');
}

function highlightLegalSquares(square) {
  removeHighlights();
  var moves = game.moves({ square: square, verbose: true });
  moves.forEach(function(m) {
    var $sq = $('[data-square="' + m.to + '"]');
    if ($sq.find('.legal-move-dot').length === 0) {
      $sq.append('<div class="legal-move-dot"></div>');
    }
  });
  $('[data-square="' + square + '"]').addClass('highlight-selected');
}

function removeHighlights() {
  $('.highlight-from').removeClass('highlight-from');
  $('.highlight-to').removeClass('highlight-to');
  $('.highlight-selected').removeClass('highlight-selected');
  $('.legal-move-dot').remove();
}

function onMouseoverSquare(square, piece) {}
function onMouseoutSquare(square, piece) {}

function onSquareClick(square, piece) {
  if (selectedSquare) {
    if (square === selectedSquare) {
      selectedSquare = null;
      removeHighlights();
      return;
    }
    if (legalDests.includes(square)) {
      var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move) {
        playMoveSound(!!move.captured);
        updateStatus();
        getResponseMove();
      }
      selectedSquare = null;
      removeHighlights();
      return;
    }
    if (piece && piece[0] === game.turn()) {
      selectedSquare = square;
      legalDests = game.moves({ square: square, verbose: true }).map(m => m.to);
      highlightLegalSquares(square);
      return;
    }
    selectedSquare = null;
    removeHighlights();
    return;
  } else {
    if (piece && piece[0] === game.turn()) {
      selectedSquare = square;
      legalDests = game.moves({ square: square, verbose: true }).map(m => m.to);
      highlightLegalSquares(square);
    }
  }
}

function blockUserInput(block) {
  if (block) {
    $('#board').addClass('block-input');
  } else {
    $('#board').removeClass('block-input');
  }
}

var cfg = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  onMouseoverSquare: onMouseoverSquare,
  onMouseoutSquare: onMouseoutSquare
};

document.addEventListener('DOMContentLoaded', function() {
  if ($('#board').length > 0) {
    board = ChessBoard('board', cfg);
  }
  var $slider = $('#boardSizeSlider');
  var $sizeValue = $('#boardSizeValue');
  function setBoardSize(size) {
    $('#board').css({ width: size + 'px', height: size + 'px' });
    safeBoardResize();
    $sizeValue.text(size + 'px');
  }
  $slider.on('input change', function() {
    setBoardSize(this.value);
  });
  setBoardSize($slider.val());
});
