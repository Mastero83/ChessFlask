var board,
  game = new Chess(),
  statusEl = $('#status'),
  fenEl = $('#fen'),
  pgnEl = $('#pgn');

var navIndex = null;

// do not pick up pieces if the game is over
// only pick up pieces for the side to move
var onDragStart = function(source, piece, position, orientation) {
  if (game.game_over() === true ||
      (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
};

var onDrop = function(source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  });

  // illegal move
  if (move === null) return 'snapback';

  // Play sound: check if capture
  playMoveSound(!!move.captured);

  updateStatus();
  getResponseMove();
};

// update the board position after the piece snap
// for castling, en passant, pawn promotion
var onSnapEnd = function() {
    board.position(game.fen());
};

var updateStatus = function() {
  var status = '';

  var moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // checkmate?
  if (game.in_checkmate() === true) {
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }

  // draw?
  else if (game.in_draw() === true) {
    status = 'Game over, drawn position';
  }

  // game still on
  else {
    status = moveColor + ' to move';

    // check?
    if (game.in_check() === true) {
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

  updateEvalBar();

  // Get last move
  var history = game.history({ verbose: true });
  if (history.length > 0) {
    aiCommentOnMove(history[history.length - 1]);
  }

  navIndex = null;
  board.position(game.fen());
};

var cfg = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
};

var randomResponse = function() {
    fen = game.fen()
    $.get($SCRIPT_ROOT + "/move/" + fen, function(data) {
        game.move(data, {sloppy: true});
        // board.position(game.fen());
        updateStatus();
    })
}

var getResponseMove = function() {
    var e = document.getElementById("sel1");
    var depth = e.options[e.selectedIndex].value;
    fen = game.fen();
    $.get($SCRIPT_ROOT + "/move/" + depth + "/" + fen, function(data) {
        var move = game.move(data, {sloppy: true});
        // Play sound: check if capture
        playMoveSound(move && !!move.captured);
        updateStatus();
        setTimeout(function(){ board.position(game.fen()); }, 100);
    })
}

var setPGN = function() {
  var table = document.getElementById("pgn");
  var pgn = game.pgn().split(" ");
  var move = pgn[pgn.length - 1];
}

var createTable = function() {

    var pgn = game.pgn().split(" ");
    var data = [];

    for (i = 0; i < pgn.length; i += 3) {
        var index = i / 3;
        data[index] = {};
        for (j = 0; j < 3; j++) {
            var label = "";
            if (j === 0) {
                label = "moveNumber";
            } else if (j === 1) {
                label = "whiteMove";
            } else if (j === 2) {
                label = "blackMove";
            }
            if (pgn.length > i + j) {
                data[index][label] = pgn[i + j];
            } else {
                data[index][label] = "";
            }
        }
    }

    $('#pgn tr').not(':first').remove();
    var html = '';
    for (var i = 0; i < data.length; i++) {
        html += '<tr><td>' + data[i].moveNumber + '</td><td>'
        + data[i].whiteMove + '</td><td>'
        + data[i].blackMove + '</td></tr>';
    }

    $('#pgn tr').first().after(html);
}

var updateScroll = function() {
    $('#moveTable').scrollTop($('#moveTable')[0].scrollHeight);
}

var setStatus = function(status) {
  document.getElementById("status").innerHTML = status;
}

var takeBack = function() {
    game.undo();
    if (game.turn() != "w") {
        game.undo();
    }
    board.position(game.fen());
    updateStatus();
}

var newGame = function() {
    game.reset();
    board.start();
    updateStatus();
}

var getCapturedPieces = function() {
    var history = game.history({ verbose: true });
    for (var i = 0; i < history.length; i++) {
        if ("captured" in history[i]) {
            console.log(history[i]["captured"]);
        }
    }
}

var getLastCapture = function() {
    var history = game.history({ verbose: true });
    var index = history.length - 1;

    if (history[index] != undefined && "captured" in history[index]) {
        console.log(history[index]["captured"]);
    }
}

// === Sound Effects ===
var moveSound = new Audio('static/sounds/move.mp3');
var captureSound = new Audio('static/sounds/capture.mp3');
moveSound.volume = 0.5;
captureSound.volume = 0.5;
var soundMuted = false;

function playMoveSound(isCapture) {
    if (soundMuted) return;
    if (isCapture) {
        captureSound.currentTime = 0;
        captureSound.play();
    } else {
        moveSound.currentTime = 0;
        moveSound.play();
    }
}

function setVolume(vol) {
    moveSound.volume = vol;
    captureSound.volume = vol;
}

function toggleMute() {
    soundMuted = !soundMuted;
    document.getElementById('muteBtn').innerText = soundMuted ? 'Unmute' : 'Mute';
}

// === ELO Mapping ===
function depthToElo(depth) {
    // Approximate mapping for simple engines
    var map = {1: 800, 2: 1100, 3: 1400, 4: 1700, 5: 2000};
    return map[depth] || (800 + depth * 400);
}

function updateEloDisplay() {
    var e = document.getElementById("sel1");
    var depth = e.options[e.selectedIndex].value;
    var elo = depthToElo(depth);
    document.getElementById('eloDisplay').innerText = 'ELO: ' + elo;
}

document.addEventListener('DOMContentLoaded', function() {
    var sel = document.getElementById('sel1');
    if (sel) sel.addEventListener('change', updateEloDisplay);
    updateEloDisplay();
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.addEventListener('input', function() {
        setVolume(this.value);
    });
});

function updateEvalBar() {
    var fen = game.fen();
    $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
        score = parseInt(score);
        // Treat near-zero as equal for display
        if (score > -10 && score < 10) score = 0;
        // Clamp score for display (e.g., -10 to +10)
        var maxEval = 10;
        var minEval = -10;
        var clamped = Math.max(minEval, Math.min(maxEval, score / 100));
        // Convert to percent: 1 = all white, 0 = all black
        var percent = (clamped - minEval) / (maxEval - minEval);
        var whiteHeight = percent * 100;
        var blackHeight = (1 - percent) * 100;
        $("#evalBarWhite").css('height', whiteHeight + '%');
        $("#evalBarBlack").css('height', blackHeight + '%');
        // Marker position (centered for 0 eval, top for max white, bottom for max black)
        var barHeight = 400; // px
        var markerHeight = 4; // px
        var markerTop = (1 - percent) * (barHeight - markerHeight);
        $("#evalBarMarker").css('top', markerTop + 'px');
    });
}

function aiCommentOnMove(move) {
    if (!move) return;
    let comment = '';
    if (move.san.includes('x')) {
        comment = `That's a strong move! ${move.color === 'w' ? 'White' : 'Black'} captures on ${move.to}.`;
        if (move.piece === 'q' && move.captured) comment = `Wow! The queen captures on ${move.to}. Bold play!`;
        if (move.piece === 'r' && move.captured) comment = `A rook capture! Sometimes sacrifices lead to brilliancies.`;
    } else if (move.san.includes('+')) {
        comment = `Check! ${move.color === 'w' ? 'White' : 'Black'} puts the king in danger.`;
    } else if (move.san.includes('#')) {
        comment = `Checkmate! What a finish!`;
    } else if (move.piece === 'r' && (move.flags.includes('c') || move.flags.includes('e'))) {
        comment = `A rook sacrifice? This could be brilliant!`;
    } else if (move.piece === 'q' && (move.flags.includes('c') || move.flags.includes('e'))) {
        comment = `Queen sacrifice! That's a rare and daring move.`;
    } else if (move.san === 'O-O' || move.san === 'O-O-O') {
        comment = `Castling for safety. A classic chess principle.`;
    } else {
        const moveNames = {
            p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
        };
        comment = `A solid move by ${move.color === 'w' ? 'White' : 'Black'} with the ${moveNames[move.piece]}.`;
    }
    const chat = document.getElementById('aiChat');
    if (chat) {
        const msg = document.createElement('div');
        msg.className = 'ai-message';
        msg.textContent = comment;
        chat.appendChild(msg);
        chat.scrollTop = chat.scrollHeight;
    }
}

var cheatPreviewBackup = null;

$(document).ready(function() {
    // Render eval bar HTML inside container
    $("#evalBarContainer").html(
        '<div id="evalBar">' +
        '<div id="evalBarWhite"></div>' +
        '<div id="evalBarBlack"></div>' +
        '<div id="evalBarMarker"></div>' +
        '</div>'
    );
    // Toggle eval bar (now in controls panel)
    $(document).on('change', '#toggleEvalBar', function() {
        if ($(this).is(':checked')) {
            $('#evalBarContainer').removeClass('eval-bar-hidden');
        } else {
            $('#evalBarContainer').addClass('eval-bar-hidden');
        }
    });
    // Default: show
    $('#evalBarContainer').removeClass('eval-bar-hidden');

    // Initialize the chess board only after DOM is ready
    board = ChessBoard('board', cfg);

    // Board size slider functionality
    var $slider = $('#boardSizeSlider');
    var $sizeValue = $('#boardSizeValue');
    function setBoardSize(size) {
        $('#board').css({ width: size + 'px', height: size + 'px' });
        board.resize();
        $sizeValue.text(size + 'px');
    }
    $slider.on('input change', function() {
        setBoardSize(this.value);
    });
    // Set initial size
    setBoardSize($slider.val());

    // Settings panel expand/collapse
    $('#settingsToggleBtn').on('click', function() {
        $('#settingsPanel').slideToggle(180);
    });

    // Cheats panel expand/collapse
    $('#cheatsToggleBtn').on('click', function() {
        $('#cheatsPanel').slideToggle(180, function() {
            if ($('#cheatsPanel').is(':visible')) {
                fetchAndShowCheatMoves();
            }
        });
    });
    // Fetch cheats after each move if panel is open
    var oldUpdateStatusCheat = updateStatus;
    updateStatus = function() {
        oldUpdateStatusCheat();
        if ($('#cheatsPanel').is(':visible')) {
            fetchAndShowCheatMoves();
        }
    };

    // AI Assistant panel toggle
    $('#aiAssistantToggleBtn').on('click', function() {
        $('#aiAssistantPanel').slideToggle(180);
    });

    // Show PGN panel on download button click
    $('#downloadPgnBtn').on('click', function() {
        $('#pgnText').val(game.pgn());
        $('#pgnPanelWrapper').css('display', 'flex');
    });
    // Close PGN panel
    $('#closePgnPanelBtn').on('click', function() {
        $('#pgnPanelWrapper').hide();
    });
    // Download PGN from panel
    $('#downloadPgnPanelBtn').on('click', function() {
        var pgn = $('#pgnText').text();
        var blob = new Blob([pgn], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'game.pgn';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    });

    // Move navigation controls
    $('#moveNavBack').on('click', function() {
        var history = game.history();
        if (navIndex === null) navIndex = history.length;
        if (navIndex > 0) {
            navIndex--;
            updateNavBoard();
        }
    });
    $('#moveNavForward').on('click', function() {
        var history = game.history();
        if (navIndex === null) navIndex = history.length;
        if (navIndex < history.length) {
            navIndex++;
            updateNavBoard();
        }
    });

    // Import PGN from panel
    $('#importPgnPanelBtn').on('click', function() {
        var pgn = $('#pgnText').val();
        var newGame = new Chess();
        if (newGame.load_pgn(pgn)) {
            game = newGame;
            board.position(game.fen());
            updateStatus();
            $('#pgnPanelWrapper').hide();
        } else {
            alert('Invalid PGN. Please check your input.');
        }
    });

    // Update PGN textarea whenever the game changes
    var oldUpdateStatusPgn = updateStatus;
    updateStatus = function() {
        oldUpdateStatusPgn();
        if ($('#pgnPanelWrapper').is(':visible')) {
            $('#pgnText').val(game.pgn());
        }
    };

    // Cheat move hover preview
    $(document).on('mouseenter', '.cheat-move', function() {
        var moveSan = $(this).find('span').first().text();
        var tempGame = new Chess();
        var history = game.history();
        for (var i = 0; i < history.length; i++) {
            tempGame.move(history[i]);
        }
        var move = tempGame.move(moveSan, { sloppy: true });
        if (move) {
            cheatPreviewBackup = board.fen();
            board.position(tempGame.fen());
            // Highlight from/to squares
            highlightSquares(move.from, move.to);
        }
    });
    $(document).on('mouseleave', '.cheat-move', function() {
        if (cheatPreviewBackup) {
            board.position(cheatPreviewBackup);
            removeHighlights();
            cheatPreviewBackup = null;
        }
    });
});

function highlightSquares(from, to) {
    removeHighlights();
    var fromSq = $('[data-square="' + from + '"]');
    var toSq = $('[data-square="' + to + '"]');
    fromSq.addClass('highlight-from');
    toSq.addClass('highlight-to');
}
function removeHighlights() {
    $('.highlight-from').removeClass('highlight-from');
    $('.highlight-to').removeClass('highlight-to');
}

// Function to update the cheats moves list (to be called after backend support is added)
function updateCheatsMovesList(moves) {
    var $list = $('#cheatsMovesList');
    $list.empty();
    if (!moves || moves.length === 0) {
        $list.append('<div class="cheat-move">(No moves yet)</div>');
        return;
    }
    moves.slice(0, 5).forEach(function(move) {
        $list.append('<div class="cheat-move">' +
            '<span>' + move.san + '</span>' +
            '<span class="cheat-move-score">' + move.score + '</span>' +
        '</div>');
    });
}

function fetchAndShowCheatMoves() {
    var e = document.getElementById("sel1");
    var depth = e ? e.value : 2;
    var fen = game.fen();
    $.get('/cheat_moves/' + depth + '/' + encodeURIComponent(fen) + '/', function(moves) {
        updateCheatsMovesList(moves);
    });
}

function updateNavBoard() {
    var history = game.history();
    var tempGame = new Chess();
    for (var i = 0; i < (navIndex !== null ? navIndex : history.length); i++) {
        tempGame.move(history[i]);
    }
    board.position(tempGame.fen());
}
