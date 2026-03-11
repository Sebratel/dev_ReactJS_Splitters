import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:nexaview/models/cliente_model.dart';
import 'package:flutter/services.dart';
import 'package:nexaview/models/solicitation_model.dart';
import 'package:nexaview/services/solicitation_service.dart';
import 'package:nexaview/services/auth_service.dart';

String _formatDate(DateTime date) {
  return '${date.day.toString().padLeft(2, '0')}/'
      '${date.month.toString().padLeft(2, '0')}/'
      '${date.year} '
      '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}';
}

class ClienteDetailPage extends StatefulWidget {
  final ClienteModel cliente;
  final AuthService authService;

  const ClienteDetailPage({
    super.key,
    required this.cliente,
    required this.authService,
  });

  @override
  State<ClienteDetailPage> createState() => _ClienteDetailPageState();
}

class _ClienteDetailPageState extends State<ClienteDetailPage> {
  static const double _pageHorizontalPadding = 16;
  static const double _pageTopPadding = 20;
  static const double _pageBottomPadding = 28;
  static const double _cardSpacing = 18;
  static const double _cardInnerPadding = 20;
  static const double _sectionHeaderSpacing = 16;

  late ClienteModel cliente;
  late Future<List<SolicitationModel>> _solicitacoesFuture;

  @override
  void initState() {
    super.initState();
    cliente = widget.cliente;
    _solicitacoesFuture = _loadSolicitacoes();
  }

  Future<List<SolicitationModel>> _loadSolicitacoes() async {
    debugPrint('Solicitacoes | clientId = ${cliente.clientId}');

    final service = SolicitationService(
      baseUrl: 'https://erp.sebratel.net.br:45715',
      authService: widget.authService,
    );

    return service.fetchByAuthenticationId(cliente.clientId);
  }

  void _copyToClipboard(BuildContext context, String label, String value) {
    if (value.trim().isEmpty) return;

    Clipboard.setData(ClipboardData(text: value));

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    //final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          // ================= HEADER PREMIUM =================
          SliverAppBar(
            expandedHeight: 130,
            pinned: true,
            backgroundColor: Colors.transparent,
            automaticallyImplyLeading: false,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              color: Colors.white,
              onPressed: () => Navigator.pop(context),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // WALLPAPER
                  Image.asset(
                    'assets/images/sebratelimagem.jpg',
                    fit: BoxFit.cover,
                  ),

                  // OVERLAY
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color.fromARGB(255, 255, 174, 0)
                              .withValues(alpha: 0.35),
                          const Color.fromARGB(255, 255, 174, 0)
                              .withValues(alpha: 0.35),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),

                  // INFO DO CLIENTE
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 24,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cliente.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            shadows: [
                              Shadow(
                                blurRadius: 6,
                                color: Colors.black54,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 12,
                          children: [
                            _badge(context, cliente.user),
                            if (cliente.port != null)
                              _badge(context, 'Porta ${cliente.port}'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ================= CONTEUDO =================
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              _pageHorizontalPadding,
              _pageTopPadding,
              _pageHorizontalPadding,
              _pageBottomPadding,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: 1280,
                    ),
                    child: _buildResponsiveSections(context),
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResponsiveSections(BuildContext context) {
    final cards = _buildSections(context);

    if (!kIsWeb) {
      return Column(children: _withSpacing(cards, spacing: _cardSpacing));
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 980) {
          return Column(children: _withSpacing(cards, spacing: _cardSpacing));
        }

        final leftBottomCards = <Widget>[
          if (cliente.address != null) _buildEnderecoSection(context),
          if (cliente.accessPoint != null) _buildPontoAcessoSection(context),
        ];

        final rightBottomCards = <Widget>[
          _buildSolicitacoesSection(context),
        ];

        final contentRow = Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                children: _withSpacing(leftBottomCards, spacing: _cardSpacing),
              ),
            ),
            const SizedBox(width: _cardSpacing),
            Expanded(
              child: Column(
                children: _withSpacing(rightBottomCards, spacing: _cardSpacing),
              ),
            ),
          ],
        );

        if (cliente.contract == null) {
          return Column(
            children: [
              _buildClienteSection(context),
              if (leftBottomCards.isNotEmpty || rightBottomCards.isNotEmpty)
                const SizedBox(height: _cardSpacing),
              contentRow,
            ],
          );
        }

        return Column(
          children: [
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: _buildClienteSection(context)),
                  const SizedBox(width: _cardSpacing),
                  Expanded(child: _buildContratoSection(context)),
                ],
              ),
            ),
            const SizedBox(height: _cardSpacing),
            contentRow,
          ],
        );
      },
    );
  }

  List<Widget> _withSpacing(List<Widget> children, {required double spacing}) {
    if (children.isEmpty) return [];

    final result = <Widget>[];
    for (int i = 0; i < children.length; i++) {
      result.add(children[i]);
      if (i < children.length - 1) {
        result.add(SizedBox(height: spacing));
      }
    }
    return result;
  }

  List<Widget> _buildSections(BuildContext context) {
    return [
      _buildClienteSection(context),
      if (cliente.address != null) _buildEnderecoSection(context),
      if (cliente.accessPoint != null) _buildPontoAcessoSection(context),
      if (cliente.contract != null) _buildContratoSection(context),
      _buildSolicitacoesSection(context),
    ];
  }

  Widget _buildClienteSection(BuildContext context) {
    return _section(
      context: context,
      icon: Icons.person,
      title: 'Cliente',
      children: [
        _item(context, 'Nome', cliente.name),
        _item(context, 'Usuário', cliente.user),
        _item(context, 'Status', cliente.status == 1 ? 'Ativo' : 'Inativo'),
      ],
    );
  }

  Widget _buildEnderecoSection(BuildContext context) {
    return _section(
      context: context,
      icon: Icons.location_on,
      title: 'Endereço',
      children: [
        _item(
          context,
          'Endereço',
          '${cliente.address!.street}, ${cliente.address!.number}',
        ),
        _item(context, 'Bairro', cliente.address!.neighborhood),
        _item(
          context,
          'Cidade',
          '${cliente.address!.city} - ${cliente.address!.state}',
        ),
        _item(context, 'CEP', cliente.address!.postalCode),
      ],
    );
  }

  Widget _buildPontoAcessoSection(BuildContext context) {
    return _section(
      context: context,
      icon: Icons.router,
      title: 'Ponto de Acesso',
      children: [
        _item(context, 'OLT', cliente.accessPoint!.title),
        _item(
          context,
          'Slot',
          cliente.accessPoint!.slotOlt.toString(),
        ),
        _item(
          context,
          'Porta',
          cliente.accessPoint!.portOlt.toString(),
        ),
      ],
    );
  }

  Widget _buildContratoSection(BuildContext context) {
    return _section(
      context: context,
      icon: Icons.description,
      title: 'Contrato',
      children: [
        _item(
          context,
          'Status',
          cliente.contract!.statusDescription,
        ),
        _item(
          context,
          'Estágio',
          cliente.contract!.stageDescription,
        ),
      ],
    );
  }

  Widget _buildSolicitacoesSection(BuildContext context) {
    return _section(
      context: context,
      icon: Icons.assignment,
      title: 'Solicitações',
      children: [
        FutureBuilder<List<SolicitationModel>>(
          future: _solicitacoesFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            }

            if (snapshot.hasError) {
              return _item(
                context,
                'Erro',
                'Não foi possível carregar solicitações',
              );
            }

            final solicitacoes = snapshot.data ?? [];

            if (solicitacoes.isEmpty) {
              return _item(
                context,
                'Status',
                'Nenhuma solicitação encontrada',
              );
            }

            return Column(
              children: [
                for (int i = 0; i < solicitacoes.length; i++) ...[
                  if (i > 0) const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Solicitação ${i + 1}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  _item(
                    context,
                    'Título',
                    solicitacoes[i].title,
                  ),
                  _item(
                    context,
                    'Protocolo',
                    solicitacoes[i].protocol.toString(),
                  ),
                  _item(
                    context,
                    'Status',
                    solicitacoes[i].status,
                  ),
                  _item(
                    context,
                    'Equipe',
                    solicitacoes[i].team,
                  ),
                  _item(
                    context,
                    'Área',
                    solicitacoes[i].sectorArea,
                  ),
                  _item(
                    context,
                    'Abertura',
                    _formatDate(
                      solicitacoes[i].beginningDate,
                    ),
                  ),
                  _item(
                    context,
                    'Fechamento',
                    solicitacoes[i].finalDate != null
                        ? _formatDate(
                            solicitacoes[i].finalDate!,
                          )
                        : 'Em andamento',
                  ),
                  if (i < solicitacoes.length - 1) const Divider(height: 22),
                ],
              ],
            );
          },
        ),
      ],
    );
  }

  // ================= COMPONENTES =================

  Widget _section({
    required BuildContext context,
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final bgColor = isDark ? const Color(0xFF1D1D1D) : Colors.white;

    final shadowColor =
        isDark ? Colors.black.withValues(alpha: 0.4) : Colors.black.withValues(alpha: 0.06);

    final titleColor = isDark ? Colors.white : Colors.black87;

    return Container(
      padding: const EdgeInsets.all(_cardInnerPadding),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: shadowColor,
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: Colors.orange),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: titleColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: _sectionHeaderSpacing),
          ...children,
        ],
      ),
    );
  }

  Widget _item(
    BuildContext context,
    String label,
    String value,
  ) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return _SelectableItemRow(
      label: label,
      value: value,
      isDark: isDark,
      onTap: () => _copyToClipboard(context, label, value),
    );
  }

  Widget _badge(BuildContext context, String text) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => _copyToClipboard(context, 'Valor', text),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55), // FIXO
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [
            BoxShadow(
              color: Colors.black54,
              blurRadius: 8,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _SelectableItemRow extends StatefulWidget {
  final String label;
  final String value;
  final bool isDark;
  final VoidCallback onTap;

  const _SelectableItemRow({
    required this.label,
    required this.value,
    required this.isDark,
    required this.onTap,
  });

  @override
  State<_SelectableItemRow> createState() => _SelectableItemRowState();
}

class _SelectableItemRowState extends State<_SelectableItemRow> {
  bool _selected = false;

  Future<void> _handleTap() async {
    setState(() => _selected = true);
    widget.onTap();

    // mantem o destaque por um curto periodo
    await Future.delayed(const Duration(milliseconds: 280));
    if (mounted) {
      setState(() => _selected = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color highlightColor = widget.isDark
        ? const Color(0xFF2A2A2A) // dark
        : const Color(0xFFFFF3D6); // light (amarelo suave)

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _handleTap,
      onLongPress: _handleTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: _selected ? highlightColor : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                widget.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  color: widget.isDark
                      ? Colors.grey.shade400
                      : Colors.grey.shade600,
                ),
              ),
            ),
            Expanded(
              child: Text(
                widget.value,
                textAlign: TextAlign.right,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: widget.isDark ? Colors.white : Colors.black87,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Icon(
              Icons.copy,
              size: 14,
              color:
                  widget.isDark ? Colors.grey.shade500 : Colors.grey.shade400,
            ),
          ],
        ),
      ),
    );
  }
}

