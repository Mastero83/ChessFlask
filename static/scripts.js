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
    $.get('/move/' + depth + '/' + encodeURIComponent(fen) + '/', function(data) {
        game.move(data, {sloppy: true});
        // board.position(game.fen());
        updateStatus();
    })
}

var getResponseMove = function() {
    var e = document.getElementById("sel1");
    var depth = e.options[e.selectedIndex].value;
    fen = game.fen();
    $.get('/move/' + depth + '/' + encodeURIComponent(fen) + '/', function(data) {
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
    var pgn = game.pgn();
    // Remove header lines
    pgn = pgn.replace(/(\[.*?\]\s*)+/g, '').trim();
    var moves = pgn.split(/\s+/);
    var data = [];
    for (i = 0; i < moves.length; i += 3) {
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
            if (moves.length > i + j) {
                data[index][label] = moves[i + j];
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

    // Settings panel expand/collapse (now only one icon at the top)
    $('#settingsToggleBtn').on('click', function() {
        $('#settingsPanel').slideToggle(180);
    });
    // Accordion logic for settings
    $('#settingsAccordion').on('show.bs.collapse', function (e) {
        $(e.target).parent().siblings().find('.panel-collapse').collapse('hide');
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

    // Load imported PGN if present
    if (window.location.pathname === '/play' && localStorage.getItem('importedPGN')) {
        var imported = localStorage.getItem('importedPGN');
        if (imported) {
            var newGame = new Chess();
            if (newGame.load_pgn(imported)) {
                game = newGame;
                board.position(game.fen());
                updateStatus();
            }
            localStorage.removeItem('importedPGN');
        }
    }

    // Hide eval bar by default
    if (!$('#toggleEvalBar').is(':checked')) {
        $('#evalBarContainer').hide();
    }
    $('#toggleEvalBar').change(function() {
        if ($(this).is(':checked')) {
            $('#evalBarContainer').show();
        } else {
            $('#evalBarContainer').hide();
        }
    });

    $('#gameOverNewGame').click(function() {
        hideGameOverOverlay();
        newGame();
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
    moves.forEach(function(move) {
        var evalDisplay = '';
        if (typeof move.score === 'number') {
            if (Math.abs(move.score) >= 10000) {
                // Mate in N
                var mateN = Math.abs(move.score) === 100000 ? '' : Math.abs(move.score);
                evalDisplay = (move.score > 0 ? '#+' : '#-') + mateN;
            } else {
                var cp = move.score / 100.0;
                evalDisplay = (cp > 0 ? '+' : '') + cp.toFixed(2);
            }
        }
        $list.append('<div class="cheat-move">' +
            '<span style="min-width:60px;display:inline-block;font-weight:bold;">' + move.san + '</span>' +
            '<span class="cheat-move-score" style="color:' + (move.score > 0 ? '#388e3c' : (move.score < 0 ? '#d32f2f' : '#888')) + '; font-weight:600; margin-left:12px;">' + evalDisplay + '</span>' +
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

// --- Metadata Panel Logic ---
function parsePgnHeaders(pgn) {
    // Extract headers from PGN string
    var headers = {};
    var headerRegex = /\[(\w+)[ \t]+"([^"]*)"\]/g;
    var match;
    while ((match = headerRegex.exec(pgn)) !== null) {
        headers[match[1]] = match[2];
    }
    return headers;
}

function renderMetaPanel(headers) {
    var fields = [
        { key: 'Event', label: 'Event' },
        { key: 'Site', label: 'Site' },
        { key: 'Date', label: 'Date' },
        { key: 'Round', label: 'Round' },
        { key: 'White', label: 'White' },
        { key: 'Black', label: 'Black' },
        { key: 'Result', label: 'Result' },
        { key: 'WhiteElo', label: 'White Elo' },
        { key: 'BlackElo', label: 'Black Elo' },
        { key: 'ECO', label: 'ECO' }
    ];
    var html = '<table class="table table-condensed" style="margin-bottom:0;">';
    fields.forEach(function(f) {
        if (headers[f.key]) {
            html += '<tr><th style="width:90px;">' + f.label + '</th><td>' + headers[f.key] + '</td></tr>';
        }
    });
    html += '</table>';
    $('#metaPanelBody').html(html);
}

function updateMetaPanelFromGame() {
    // Get headers from current game PGN
    var pgn = game.pgn();
    var headers = parsePgnHeaders(pgn);
    renderMetaPanel(headers);
}

// Toggle meta panel
$(document).on('click', '#metaPanelToggleBtn', function() {
    $('#metaPanel').slideToggle(180);
});

// Show meta panel by default if desired
// $('#metaPanel').show();

// When loading a new PGN (import or from opening selection), update meta panel
var oldUpdateStatusMeta = updateStatus;
updateStatus = function() {
    oldUpdateStatusMeta();
    updateMetaPanelFromGame();
};

// When importing PGN, also update meta panel
$('#importPgnPanelBtn').on('click', function() {
    setTimeout(updateMetaPanelFromGame, 100);
});

// When loading imported PGN from localStorage (on /play), update meta panel
if (window.location.pathname === '/play' && localStorage.getItem('importedPGN')) {
    setTimeout(updateMetaPanelFromGame, 200);
}

var showGameOverOverlay = function(winner, moves, reason) {
    // Set winner and move info
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
    $('#gameOverOverlay').fadeIn(400);
    startFireworks();
};

var hideGameOverOverlay = function() {
    $('#gameOverOverlay').fadeOut(200);
    stopFireworks();
};

// Fireworks animation (simple)
var fireworksInterval;
function startFireworks() {
    var canvas = document.getElementById('fireworksCanvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var particles = [];
    function randomColor() {
        var colors = ['#ff5252','#ffd600','#69f0ae','#40c4ff','#b388ff','#ff4081'];
        return colors[Math.floor(Math.random()*colors.length)];
    }
    function createParticle() {
        var x = Math.random()*canvas.width;
        var y = Math.random()*canvas.height*0.6;
        var r = 2+Math.random()*3;
        var color = randomColor();
        var dx = (Math.random()-0.5)*6;
        var dy = (Math.random()-1.2)*6;
        var life = 60+Math.random()*30;
        particles.push({x,y,r,color,dx,dy,life});
    }
    fireworksInterval = setInterval(function() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if (particles.length<80) for(var i=0;i<8;i++) createParticle();
        for(var i=0;i<particles.length;i++) {
            var p=particles[i];
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
            ctx.fillStyle=p.color;
            ctx.globalAlpha = Math.max(0,p.life/90);
            ctx.fill();
            p.x+=p.dx; p.y+=p.dy; p.dy+=0.08; p.life--;
        }
        particles=particles.filter(p=>p.life>0);
        ctx.globalAlpha=1;
    },30);
}
function stopFireworks() {
    clearInterval(fireworksInterval);
    var canvas = document.getElementById('fireworksCanvas');
    if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
    }
}

// Fetch and display Stockfish evaluation for the current position
function fetchAndDisplayEval() {
    var fen = game.fen();
    $.get('/eval/' + encodeURIComponent(fen) + '/', function(score) {
        // If you have an evaluation bar, update it here
        // Example: updateEvalBar(score);
        // Or display the score somewhere in the UI
        console.log('Stockfish eval:', score);
    });
}

// --- Socket.IO real-time Stockfish debug integration ---
var socket = null;
var stockfishDebugStarted = false;
$(document).on('click', '#debugToggleBtn', function() {
    $('#debugPanel').slideToggle(180);
    if ($('#debugPanel').is(':visible') && !stockfishDebugStarted) {
        if (!socket) {
            socket = io();
        }
        $('#debugOutput').val('');
        socket.emit('start_stockfish_debug');
        stockfishDebugStarted = true;
        socket.on('debug_output', function(line) {
            appendDebugOutput(line);
        });
    }
});

// Function to append text to the debug output textarea
function appendDebugOutput(text) {
    var $output = $('#debugOutput');
    $output.val($output.val() + text + '\n');
    $output.scrollTop($output[0].scrollHeight);
}
// Example usage: appendDebugOutput('Stockfish started...');
