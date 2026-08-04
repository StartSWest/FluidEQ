Feature: Set gain of a frequency band
  Users want to change the gain of a filter applied to a certain frequency

  Scenario: Move slider to bottom
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And the frequency of band 1 is 1000Hz
      And FluidEQ equalizer state is enabled
    When I set gain of slider of frequency 1000Hz to bottom
    Then FluidEQ config file should show gain of -20dB for frequency 1000Hz
