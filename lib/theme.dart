import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LightModeColors {
  static const lightPrimary = Color(0xFF7C3AED);
  static const lightOnPrimary = Color.fromARGB(255, 54, 54, 54);
  static const lightPrimaryContainer = Color(0xFFF3E8FF);
  static const lightOnPrimaryContainer = Color(0xFF3B0764);
  static const lightSecondary = Color(0xFF06B6D4);
  static const lightOnSecondary = Color(0xFFFFFFFF);
  static const lightTertiary = Color(0xFFF97316);
  static const lightOnTertiary = Color.fromARGB(255, 59, 214, 54);
  static const lightAccent = Color(0xFF10B981);
  static const lightOnAccent = Color(0xFFFFFFFF);
  static const lightError = Color(0xFFEF4444);
  static const lightOnError = Color(0xFFFFFFFF);
  static const lightErrorContainer = Color(0xFFFEE2E2);
  static const lightOnErrorContainer = Color(0xFF7F1D1D);
  static const lightInversePrimary = Color(0xFFA78BFA);
  static const lightShadow = Color(0xFF000000);
  static const lightSurface = Color(0xFFFAFAFA);
  static const lightOnSurface = Color.fromARGB(255, 255, 255, 255);
  static const lightAppBarBackground = Color.fromARGB(255, 255, 255, 255);
  static const lightCardBackground = Color(0xFFFFFFFF);
  // FUNDO GERAL (off-white)
  static const lightBackground = Color.fromARGB(255, 109, 109, 109);
}

class DarkModeColors {
  static const darkPrimary = Color(0xFFA78BFA);
  static const darkOnPrimary = Color.fromARGB(255, 255, 255, 255);
  static const darkPrimaryContainer = Color(0xFF6B21A8);
  static const darkOnPrimaryContainer = Color(0xFFF3E8FF);
  static const darkSecondary = Color(0xFF22D3EE);
  static const darkOnSecondary = Color.fromARGB(255, 58, 58, 58);
  static const darkTertiary = Color(0xFFF97316);
  static const darkOnTertiary = Color.fromARGB(255, 59, 214, 54);
  static const darkAccent = Color(0xFF34D399);
  static const darkOnAccent = Color(0xFF064E3B);
  static const darkError = Color(0xFFEF4444);
  static const darkOnError = Color(0xFF7F1D1D);
  static const darkErrorContainer = Color(0xFFB91C1C);
  static const darkOnErrorContainer = Color(0xFF7F1D1D);
  static const darkInversePrimary = Color.fromARGB(255, 148, 133, 175);
  static const darkShadow = Color(0xFF000000);
  static const darkBackground = Color(0xFF121212); // fundo geral
  static const darkSurface = Color(0xFF1C1C1C); // cards / containers
  static const darkCardBackground = Color(0xFF1C1C1C);
  static const darkAppBarBackground = Color(0xFF181818);

  static const darkOnSurface = Color(0xFFE5E5E5); // texto principal
}

class FontSizes {
  static const double displayLarge = 57.0;
  static const double displayMedium = 45.0;
  static const double displaySmall = 36.0;
  static const double headlineLarge = 32.0;
  static const double headlineMedium = 24.0;
  static const double headlineSmall = 22.0;
  static const double titleLarge = 22.0;
  static const double titleMedium = 18.0;
  static const double titleSmall = 16.0;
  static const double labelLarge = 16.0;
  static const double labelMedium = 14.0;
  static const double labelSmall = 12.0;
  static const double bodyLarge = 16.0;
  static const double bodyMedium = 14.0;
  static const double bodySmall = 12.0;
}

ThemeData get lightTheme => ThemeData(
      chipTheme: ChipThemeData(
        side: BorderSide.none,
      ),
      useMaterial3: true,
      brightness: Brightness.light,

      // FUNDOS GLOBAIS
      scaffoldBackgroundColor: const Color.fromARGB(255, 241, 241, 241),
      canvasColor: const Color.fromARGB(255, 255, 255, 255),
      cardColor: const Color.fromARGB(255, 255, 255, 255),

      // ESQUEMA DE CORES
      colorScheme: ColorScheme.light(
        primary: LightModeColors.lightPrimary,
        secondary: LightModeColors.lightSecondary,
        tertiary: LightModeColors.lightTertiary,
        error: LightModeColors.lightError,
        surface: const Color.fromARGB(255, 230, 230, 230),
        onSurface: LightModeColors.lightOnSurface,
        onPrimary: LightModeColors.lightOnPrimary,
        onSecondary: LightModeColors.lightOnSecondary,
        onTertiary: LightModeColors.lightOnTertiary,
        onError: LightModeColors.lightOnError,
        inversePrimary: LightModeColors.lightInversePrimary,
        shadow: LightModeColors.lightShadow,
      ),

      // APP BAR
      appBarTheme: const AppBarTheme(
        backgroundColor: Color.fromARGB(255, 100, 99, 99),
        foregroundColor: Color.fromARGB(255, 92, 91, 91),
        elevation: 0,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.inter(
          fontSize: FontSizes.displayLarge,
          fontWeight: FontWeight.normal,
        ),
        displayMedium: GoogleFonts.inter(
          fontSize: FontSizes.displayMedium,
          fontWeight: FontWeight.normal,
        ),
        displaySmall: GoogleFonts.inter(
          fontSize: FontSizes.displaySmall,
          fontWeight: FontWeight.w600,
        ),
        headlineLarge: GoogleFonts.inter(
          fontSize: FontSizes.headlineLarge,
          fontWeight: FontWeight.normal,
        ),
        headlineMedium: GoogleFonts.inter(
          fontSize: FontSizes.headlineMedium,
          fontWeight: FontWeight.w500,
        ),
        headlineSmall: GoogleFonts.inter(
          fontSize: FontSizes.headlineSmall,
          fontWeight: FontWeight.bold,
        ),
        titleLarge: GoogleFonts.inter(
          fontSize: FontSizes.titleLarge,
          fontWeight: FontWeight.w500,
        ),
        titleMedium: GoogleFonts.inter(
          fontSize: FontSizes.titleMedium,
          fontWeight: FontWeight.w500,
        ),
        titleSmall: GoogleFonts.inter(
          fontSize: FontSizes.titleSmall,
          fontWeight: FontWeight.w500,
        ),
        labelLarge: GoogleFonts.inter(
          fontSize: FontSizes.labelLarge,
          fontWeight: FontWeight.w500,
        ),
        labelMedium: GoogleFonts.inter(
          fontSize: FontSizes.labelMedium,
          fontWeight: FontWeight.w500,
        ),
        labelSmall: GoogleFonts.inter(
          fontSize: FontSizes.labelSmall,
          fontWeight: FontWeight.w500,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: FontSizes.bodyLarge,
          fontWeight: FontWeight.normal,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: FontSizes.bodyMedium,
          fontWeight: FontWeight.normal,
        ),
        bodySmall: GoogleFonts.inter(
          fontSize: FontSizes.bodySmall,
          fontWeight: FontWeight.normal,
        ),
      ),
    );

ThemeData get darkTheme => ThemeData(
      chipTheme: ChipThemeData(
        side: BorderSide.none,
      ),
      useMaterial3: true,
      // FUNDOS GLOBAIS (ESSENCIAL)
      scaffoldBackgroundColor: DarkModeColors.darkBackground,
      canvasColor: DarkModeColors.darkBackground,
      cardColor: DarkModeColors.darkCardBackground,
      colorScheme: ColorScheme.dark(
        primary: DarkModeColors.darkPrimary,
        onPrimary: DarkModeColors.darkOnPrimary,
        primaryContainer: DarkModeColors.darkPrimaryContainer,
        onPrimaryContainer: DarkModeColors.darkOnPrimaryContainer,
        secondary: DarkModeColors.darkSecondary,
        onSecondary: DarkModeColors.darkOnSecondary,
        tertiary: DarkModeColors.darkTertiary,
        onTertiary: DarkModeColors.darkOnTertiary,
        error: DarkModeColors.darkError,
        onError: DarkModeColors.darkOnError,
        errorContainer: DarkModeColors.darkErrorContainer,
        onErrorContainer: DarkModeColors.darkOnErrorContainer,
        inversePrimary: DarkModeColors.darkInversePrimary,
        shadow: DarkModeColors.darkShadow,

        // AQUI EST? O CORA??O DO DARK MODE
        surface: const Color.fromARGB(255, 54, 54, 54),
        onSurface: DarkModeColors.darkOnSurface,
      ),
      brightness: Brightness.dark,
      appBarTheme: AppBarTheme(
        backgroundColor: DarkModeColors.darkAppBarBackground,
        foregroundColor: DarkModeColors.darkOnPrimaryContainer,
        elevation: 0,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.inter(
          fontSize: FontSizes.displayLarge,
          fontWeight: FontWeight.normal,
        ),
        displayMedium: GoogleFonts.inter(
          fontSize: FontSizes.displayMedium,
          fontWeight: FontWeight.normal,
        ),
        displaySmall: GoogleFonts.inter(
          fontSize: FontSizes.displaySmall,
          fontWeight: FontWeight.w600,
        ),
        headlineLarge: GoogleFonts.inter(
          fontSize: FontSizes.headlineLarge,
          fontWeight: FontWeight.normal,
        ),
        headlineMedium: GoogleFonts.inter(
          fontSize: FontSizes.headlineMedium,
          fontWeight: FontWeight.w500,
        ),
        headlineSmall: GoogleFonts.inter(
          fontSize: FontSizes.headlineSmall,
          fontWeight: FontWeight.bold,
        ),
        titleLarge: GoogleFonts.inter(
          fontSize: FontSizes.titleLarge,
          fontWeight: FontWeight.w500,
        ),
        titleMedium: GoogleFonts.inter(
          fontSize: FontSizes.titleMedium,
          fontWeight: FontWeight.w500,
        ),
        titleSmall: GoogleFonts.inter(
          fontSize: FontSizes.titleSmall,
          fontWeight: FontWeight.w500,
        ),
        labelLarge: GoogleFonts.inter(
          fontSize: FontSizes.labelLarge,
          fontWeight: FontWeight.w500,
        ),
        labelMedium: GoogleFonts.inter(
          fontSize: FontSizes.labelMedium,
          fontWeight: FontWeight.w500,
        ),
        labelSmall: GoogleFonts.inter(
          fontSize: FontSizes.labelSmall,
          fontWeight: FontWeight.w500,
        ),
        bodyLarge: GoogleFonts.inter(
          fontSize: FontSizes.bodyLarge,
          fontWeight: FontWeight.normal,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: FontSizes.bodyMedium,
          fontWeight: FontWeight.normal,
        ),
        bodySmall: GoogleFonts.inter(
          fontSize: FontSizes.bodySmall,
          fontWeight: FontWeight.normal,
        ),
      ),
    );
