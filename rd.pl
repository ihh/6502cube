% * -*- Mode: Prolog -*- */

% ----------------------------------------
% MAIN PROGRAM
% ----------------------------------------

main :-
        current_prolog_flag(argv, Arguments),
        (append(_SystemArgs, [--|Args], Arguments) ; =(Arguments,Args)),
        !,
        parse_args(Args,Opts),
	format("Opts: ~w~n",[Opts]),
	halt_success.

halt_success :-
	halt(0).

% ----------------------------------------
% OPTION PROCESSING
% ----------------------------------------

parse_args([],[]).
parse_args([Alias|Rest],Opt) :-
	arg_alias(Arg,Alias),
	!,
	parse_args([Arg|Rest],Opt).
parse_args([ArgEqualsVal|Rest],Opts) :-
        string_chars(ArgEqualsVal,C),
        phrase(arg_equals_val(Arg,Val),C),
	!,
	parse_args([Arg,Val|Rest],Opts).
parse_args([MultiArgs|Args],Opts) :-
        string_codes(MultiArgs,C),
        phrase(multi_args(MultiOpts),C),
	!,
        append(MultiOpts,RestOpts,Opts),
        parse_args(Args,RestOpts).
parse_args(Args,Opts) :-
        parse_arg(Args,RestArgs,Opt),
        !,
	(Opt = [_|_] -> ArgOpts = Opt; ArgOpts = [Opt]),
	append(ArgOpts,RestOpts,Opts),
        parse_args(RestArgs,RestOpts).
parse_args([A|Args],[toplevel(A)|Opts]) :-
        parse_args(Args,Opts).

arg_equals_val(Arg,Val) --> arg_chars(Arg), ['='], !, val_chars(Val).
arg_chars(A) --> ['-','-'], char_list(Ac,"="), {atom_chars(A,['-','-'|Ac])}.
val_chars(V) --> atom_from_chars(V,"").

multi_args(Opts) --> "-", multi_arg(Opts).
multi_arg([Opt|Rest]) --> [C], {char_code('-',H),C\=H,atom_codes(Arg,[H,C])}, !, {parse_arg([Arg],[],Opt)}, !, multi_arg(Rest).
multi_arg([]) --> !.

:- discontiguous parse_arg/3.   % describes how to parse a cmdline arg into an option
:- discontiguous recover_arg/2. % describes how to recover the cmdline arg from the option (finding canonical paths, etc)
:- discontiguous simple_arg/2.  % combines parse_arg & recover_arg for simple options with no parameters
:- discontiguous arg_alias/2.   % specifies an alias for a cmdline arg
:- discontiguous arg_info/3.    % specifies the help text for a cmdline arg

parse_arg([Arg|L],L,Opt) :- simple_arg(Arg,Opt).
recover_arg(Arg,Opt) :- simple_arg(Arg,Opt).

% ----------------------------------------
% COMMON OPERATIONS
% ----------------------------------------

parse_arg(['-h'|L],L,null) :- show_help, !.
arg_alias('-h','--help').
arg_info('-h','','Show help').

show_help :-
        writeln('rd [options...] file'),
        nl,
        writeln('Options:'),
	forall(arg_info(X,Args,Info),
	       ((bagof(Alias,arg_alias(X,Alias),AliasList); AliasList = []),
	        atomic_list_concat([X|AliasList],",",AliasStr),
	        format("~w ~w~n    ~w~n",[AliasStr,Args,Info]))),
        nl,
        halt_success.

parse_arg(['-v'|L],L,null) :- show_version, !.
arg_alias('-v','--version').
arg_info('-v','','Show version').

show_version :-
        writeln('rd v0.1'),
        writeln('Copyright (C) 2020 Evolutionary Software Foundation, Inc.'),
        writeln('Author: Ian Holmes.'),
        writeln('This is free software; see the source for copying conditions.'),
        writeln('There is NO warranty; not even for MERCHANTABILITY or FITNESS FOR A'),
        writeln('PARTICULAR PURPOSE.'),
        halt_success.
