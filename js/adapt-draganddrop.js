define(function(require) {

	var Adapt = require("coreJS/adapt");
	var QuestionView = require("coreViews/questionView");
	var JQueryUI = require("./jquery-ui.js");
	var TouchPunch = require("./jquery.ui.touch-punch.js")

	var draganddrop = QuestionView.extend({

		events: {
			"dragcreate .ui-draggable": "onDragCreate",
			"dragstart .ui-draggable": "onDragStart",
			"drag .ui-draggable": "onDrag",
			"dragstop .ui-draggable": "onDragStop",
			"drop .ui-droppable": "onDrop",
			"dropout .ui-droppable": "onDropOut",
			"dropover .ui-droppable": "onDropOver"
		},

		/************************************** SETUP METHODS **************************************/

		setupQuestion: function() {

			// Create a single, random array of all available answers
			var possibleAnswers = _.shuffle(this.getAnswers(true));
			this.model.set("_possibleAnswers", possibleAnswers);

			// Make sure each item's accepted answer is an array - even single values
			// This simplifies future operations
			_.each(this.model.get("_items"), function(item) {
				if (typeof item.accepted === "string") item.accepted = [item.accepted];
			});
		},

		onQuestionRendered: function() {
			this.setupDragAndDropItems();
			//this.restoreUserAnswer();
			this.setReadyStatus();
		},

		setupDragAndDropItems : function () {

			this.$(".draganddrop-answer").draggable({containment: this.$(".draganddrop-inner")});

			//Activate droppables and set heights from draggable heights
			var hItem = this.$(".draganddrop-answer").height();

			this.$(".draganddrop-droppable").droppable({
				activeClass: "ui-state-active",
				tolerance: "intersect"
			}).height(hItem);

			//Set widths of all drag and drop items according to the widest element
			var $items = this.$(".draganddrop-item");
			var wMax = this.getMaxWidth($items);
			$items.width(wMax);

			// Store original position of draggables
			_.each(this.$(".ui-draggable"), function (draggable) {
				var $draggable = $(draggable);
				$draggable.data({
					originalPosition: {top: 0, left: 0},
					position: $draggable.position()
				});
			});
		},

		restoreUserAnswer: function() {

			if (!this.model.get("_isSubmitted")) return;

			var answers = this.getAnswers(true);
			var userAnswers = this.model.get("_userAnswer");
			var $droppables = this.$(".ui-droppable");
			var i = -1;
			if (userAnswers) {
				_.each(this.model.get("_items"), function(item) {
					var accepted = item.accepted;
					item._userAnswer = [];
					_.each(accepted, function() {
						i++;
						item._userAnswer.push(answers[userAnswers[i]]);
					});
				});

				_.each(userAnswers, function (answerIndex, i) {
					if (answerIndex > -1) {
						var answer = answers[answerIndex];
						var $draggable = this.getDraggableByText(answer);
						var $droppable = $droppables.eq(i);
						this.placeDraggable($draggable, $droppable, 0);
					}
				}, this);
			}

			this.setQuestionAsSubmitted();
			this.markQuestion();
			this.setScore();
			this.showMarking();
			this.setupFeedback();
		},

		/************************************** HELPER METHODS **************************************/

		getMaxWidth: function($collection) {
			var wMax = 0;
			for (var i = 0; i < $collection.length; i++) {
				var w = $collection.eq(i).width();
				if (w > wMax) wMax = w;
			}
			return wMax + 1;
		},

		getDraggableByText: function(text) {
			var draggable = _.find(this.$(".draganddrop-answer"), function(draggable) {
				var $draggable = $(draggable);
				return $draggable.text() === text;
			});

			return $(draggable);
		},

		getAnswers: function(includeDummyAnswers) {
			var answers = [];
			_.each(this.model.get("_items"), function (item) {
				answers = answers.concat(item.accepted);
			});

			if (includeDummyAnswers) {
				var dummyAnswers = this.model.get("dummyAnswers");
				if (dummyAnswers) answers = answers.concat(dummyAnswers);
			}

			return answers
		},

		/************************************** DRAG AND DROP METHODS **************************************/

		onDragCreate: function(e) {

			var $draggable = $(e.target);
			$draggable.css({left: 0, top: 0});
		},

		onDragStart : function(e, ui) {

			if (!this.model.get("_isEnabled")) return;

			var fromDroppable = ui.helper.data("droppable");
			ui.helper.data("fromDroppable", fromDroppable);
			this.$(".draganddrop-widget").addClass("dragging");
			this.$currentDraggable = ui.helper;
			this.$currentDraggable.removeClass("ui-state-placed");
		},

		onDrag: function(e, ui) {
		},

		onDragStop : function(e, ui) {
			this.$(".draganddrop-widget").removeClass("dragging");
			this.$(".ui-state-hover").removeClass("ui-state-hover");

			var fromDroppable = ui.helper.data("fromDroppable");
			if (fromDroppable && fromDroppable !== this.$currentDroppable) {
				fromDroppable.removeClass("ui-state-disabled").addClass("ui-state-enabled").removeData();
			}

			if (!this.$currentDroppable || this.$currentDroppable.is(".ui-state-disabled")) {
				this.resetDraggable();
				return;
			}

			setTimeout(function() {
				ui.helper.addClass("ui-draggable-dragging");
			}, 2);
			setTimeout(function() {
				ui.helper.removeClass("ui-draggable-dragging");
			}, this.model.get("animationTime") || 300);

			var userAnswer = this.$currentDraggable.text();
			this.$currentDroppable.data("userAnswer", userAnswer);
			var $question = this.$currentDroppable.parents();
			var $children = $question.children(".ui-droppable");
			var questionIndex = $question.index();
			var numAnswers = $children.length;
			var item = this.model.get("_items")[questionIndex];

			if (numAnswers > 1) {
				item._userAnswer = _.map($children, function(droppable) {
					return $(droppable).data("userAnswer");
				});
			} else {
				item._userAnswer = [userAnswer];
			}

			this.placeDraggable(this.$currentDraggable, this.$currentDroppable, 200);
			this.storeUserAnswer();
		},

		onDropOut: function(e, ui) {
			$(e.target).removeClass("ui-state-hover");
			var $droppable = this.$currentDraggable.data("droppable");
			if ($droppable) $droppable.removeClass("ui-state-disabled").addClass("ui-state-enabled");

			if (this.$currentDroppable && e.target === this.$currentDroppable[0]) {
				this.$currentDraggable.data("droppable", null);
				this.$currentDroppable = null;
			}
		},

		onDropOver: function(e, ui) {
			var $target = $(e.target);
			if ($target.is(".ui-state-disabled")) return;
			if (this.$currentDroppable) this.$currentDroppable.removeClass("ui-state-hover");
			$target.addClass("ui-state-hover");
			this.$currentDroppable = $target;
		},

		setCurrentDroppable: function() {

		},

		placeDraggable: function($draggable, $droppable, animationTime) {

			if (animationTime === undefined) animationTime = this.model.get("animationTime") || 300;

			$draggable.removeClass("ui-state-placed");

			var dragLeft = $draggable.data("position") ? $draggable.data("position").left : $draggable.position().left;
			var dragTop = $draggable.data("position") ? $draggable.data("position").top : $draggable.position().top;
			var left = $droppable.position().left - dragLeft + parseInt($droppable.css("border-left-width"));
			var top = $droppable.position().top - dragTop + parseInt($droppable.css("border-top-width"));

			$draggable.animate({left: left, top: top}, animationTime);
			$droppable.removeClass("ui-state-enabled")
				.addClass("ui-state-disabled")
				.data("answer", $draggable.text());

			var that = this;
			setTimeout(function() {
				$draggable.addClass("ui-state-placed").data("droppable", $droppable);
			}, animationTime);

			this.queue = setTimeout(function() {
				that.$currentDroppable = null;
			}, animationTime);
		},

		resetDraggable: function($draggable, position, animationTime) {
			$draggable = $draggable || this.$currentDraggable;
			position = position || $draggable.data().originalPosition;
			if (animationTime === undefined) animationTime = this.model.get("animationTime") || 300;
			if ($draggable.data("droppable")) $draggable.data("droppable").addClass("ui-state-enabled");

			$draggable.animate(position, animationTime)
				.removeClass("ui-state-placed")
				.data("droppable", null);

		},

		/************************************** QUESTION METHODS **************************************/

		canSubmit: function() {
			return this.$(".ui-state-enabled").length === 0;
		},

		showMarking: function() {
			_.each(this.model.get("_items"), function(item, i) {
				var $question = this.$(".draganddrop-question").eq(i);
				$question.removeClass("correct incorrect").addClass(item._isCorrect ? "correct" : "incorrect");
			}, this);
		},

		isCorrect: function() {
			this.markAnswers();

			// do we have any _isCorrect == false?
			return !_.contains(_.pluck(this.model.get("_items"),"_isCorrect"), false);
		},

		markAnswers: function() {
			var numberOfCorrectAnswers = 0;
			this.model.set("_isAtLeastOneCorrectSelection", false);
			_.each(this.model.get("_items"), function(item) {

				item._isCorrect = item.accepted.sort().join() === item._userAnswer.sort().join();

				if (item._isCorrect) {
					numberOfCorrectAnswers ++;
					this.model.set("_numberOfCorrectAnswers", numberOfCorrectAnswers);
					this.model.set("_isAtLeastOneCorrectSelection", true);
				}
			}, this);
		},

		resetQuestion: function() {

			this.$(".draganddrop-question").removeClass("correct incorrect");
			this.$(".ui-droppable").removeClass("ui-state-disabled");

			_.each(this.$(".ui-state-placed"), function(draggable) {
				this.resetDraggable($(draggable));
			}, this);

			_.each(this.model.get("_items"), function(item, i){
				item._isCorrect = false;
			});
		},

		hideCorrectAnswer: function() {
			this.showAnswer(true);
		},

		showCorrectAnswer: function() {
			this.showAnswer();
		},

		disableButtonActions: function(val) {
			this.$(".buttons-action").prop("disabled", val);
		},

		showAnswer: function(showUserAnswer) {
			var $droppables = this.$(".ui-droppable");
			var context = this;
			this.disableButtonActions(true);

			if (!$droppables.length) return; //Necessary as method is automatically called before drag and drop elements are rendered
			setTimeout(function() {
				context.disableButtonActions(false);
			}, this.model.get("animationTime") || 300);

			if (!$droppables.length) return; //Necessary as method is automatically called before drag and drop elements are rendered
			var items = this.model.get("_items");
			var dummyAnswers = this.model.get("dummyAnswers") || [];
			var userAnswers = _.flatten(_.pluck(items, "_userAnswer"));
			var usedDroppables = [];
			var toReset = [];
			var toPlace = [];
			var toMove = [];

			_.each(items, function(item, i) {

				var $question = this.$(".draganddrop-question").eq(i);

				item._userAnswer.sort();
				item.accepted.sort();
				if (item._userAnswer.join() !== item.accepted.join()) {
					var itemUserAnswers = _.difference(item._userAnswer, item.accepted);
					var acceptedAnswers = _.difference(item.accepted, item._userAnswer);
					var difference = userAnswers.concat(acceptedAnswers);

					_.each(itemUserAnswers, function(userAnswer, j) {

						var answerPlace = showUserAnswer ? userAnswer : acceptedAnswers[j];
						var answerReset = showUserAnswer ? acceptedAnswers[j] : userAnswer;
						var droppable = _.find($question.children(".ui-droppable"), function(droppable) {
							var answer = $(droppable).data().answer;
							if (usedDroppables.indexOf(droppable) > -1) return false;
							usedDroppables.push(droppable);
							return ((!showUserAnswer && item.accepted.indexOf(answer) === -1) || (showUserAnswer && item._userAnswer.indexOf(answer) === -1));
						});
						var $droppable = $(droppable);
						placeDraggables(answerPlace, answerReset, $droppable, this);
					}, this);
				}
			}, this);

			var draggables = toReset.concat(toMove, toPlace);

			_.each(draggables, function($, i) {
				var delay = this.model.get("animationDelay") || 0;
				var t = i * delay;
				var that = this;
				setTimeout(function() {
					$.drop ? that.placeDraggable($.drag, $.drop) : that.resetDraggable($.drag);
				}, t);
			}, this);

			function placeDraggables(answerPlace, answerReset, $droppable, instance) {
				var $draggablePlace = instance.getDraggableByText(answerPlace);
				var $draggableReset = instance.getDraggableByText(answerReset);
				var isReset = (
				(showUserAnswer && userAnswers.indexOf(answerReset) === -1) ||
				(!showUserAnswer && dummyAnswers.indexOf(answerReset) > -1));
				$draggablePlace.hasClass("ui-state-placed") ?
					toMove.push({drag: $draggablePlace, drop: $droppable}) :
					toPlace.push({drag: $draggablePlace, drop: $droppable});
				if (isReset) toReset.push({drag: $draggableReset});
			}
		},

		storeUserAnswer: function() {

			var answers = this.getAnswers(true);
			var $droppables = this.$(".ui-droppable");
			var userAnswers = _.map($droppables, function (droppable, i) {
				var answer = $droppables.eq(i).data("userAnswer");
				return answers.indexOf(answer);
			});

			this.model.set("_userAnswer", userAnswers);
		},

		setScore: function() {
			var numberOfCorrectAnswers = this.model.get("_numberOfCorrectAnswers") || 0;
			var questionWeight = this.model.get("_questionWeight");
			var itemLength = this.model.get("_items").length;

			var score = questionWeight * numberOfCorrectAnswers / itemLength;

			this.model.set("_score", score);
		},

		disableQuestion: function() {
			this.$(".draganddrop-answers").children().draggable("disable");
		},

		enableQuestion: function() {
			this.$(".draganddrop-answers").children().draggable("enable");
		}
	});

	Adapt.register("draganddrop", draganddrop);
});
