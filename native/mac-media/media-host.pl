#!/usr/bin/perl
# FluidEQ — GPL-3.0-or-later
# Host loading technique: ungive/mediaremote-adapter, BSD-3-Clause;
# see vendor/VENDORED.md and the accompanying LICENSE.txt.
use strict;
use warnings;
use DynaLoader;
use File::Spec;

my $framework = shift @ARGV;
die "Expected one absolute framework path\n"
  unless defined($framework) && File::Spec->file_name_is_absolute($framework)
  && !@ARGV;
my $binary = File::Spec->catfile($framework, 'FluidEQMedia');
my $library = DynaLoader::dl_load_file($binary, 0)
  or die "Could not load FluidEQ media adapter\n";
my $symbol = DynaLoader::dl_find_symbol($library, 'fluideq_media_watch')
  or die "FluidEQ media adapter entry point is missing\n";
DynaLoader::dl_install_xsub('main::watch', $symbol);
watch();
