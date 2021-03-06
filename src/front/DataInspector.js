L.TileLayer.XRay = L.TileLayer.extend({

    getTileUrl: function (tilePoint) {
        this.options.version = Date.now();
        this.options.showLayer = L.K.Config.dataInspectorLayer || '';
        this.options.background = L.K.Config.dataInspectorBackground || '';
        return L.TileLayer.prototype.getTileUrl.call(this, tilePoint);
    }

});

L.Kosmtik.DataInspector = L.Class.extend({

    includes: [L.Mixin.Events],

    initialize: function (map) {
        this.map = map;
        var options = {
            minZoom: this.map.options.minZoom,
            maxZoom: this.map.options.maxZoom
        };
        this.tilelayer = new L.TileLayer.XRay('./tile/{z}/{x}/{y}.xray?t={version}&layer={showLayer}&background={background}', options);
        this.tilelayer.on('loading', function () {this.setState('loading');}, this.map);
        this.tilelayer.on('load', function () {this.unsetState('loading');}, this.map);
        this.createSidebarPanel();
        this.createToolbarButton();
        this.addCommands();
        this.map.on('click', function (e) {
            if (!L.K.Config.dataInspector) return;
            var url = L.Util.template('./query/{z}/{lat}/{lng}/?layer={layer}', {
                z: this.map.getZoom(),
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                layer: L.K.Config.dataInspectorLayer || ''
            });
            L.K.Xhr.get(url, {
                callback: function (status, data) {
                    if (status !== 200) return;  // display message?
                    data = JSON.parse(data);
                    if (!data.length) return;
                    var content = L.DomUtil.create('div', 'data-inspector');
                    data.map(function (feature) {
                        feature.attributes.layer = feature.layer;
                        content.appendChild(L.K.Util.renderPropertiesTable(feature.attributes));
                    });
                    this.map.openPopup(content, e.latlng, {autoPan: false});
                },
                context: this
            });
        }, this);
        this.map.on('reload', this.redraw, this);
    },

    createSidebarPanel: function () {
        this.container = L.DomUtil.create('div', 'data-inspector-form');
        this.title = L.DomUtil.create('h3', '', this.container);
        this.formContainer = L.DomUtil.create('div', '', this.container);
        this.title.innerHTML = 'Data Inspector';
        var layers = [['__all__', 'all']].concat(L.K.Config.project.layers.map(function (l) {return [l.name, l.name];}));
        var backgrounds = [['black', 'black'], ['transparent', 'transparent']];
        this.sidebarForm = new L.K.FormBuilder(L.K.Config, [
            ['dataInspector', {handler: L.K.Switch, label: 'Active'}],
            ['dataInspectorLayer', {handler: L.FormBuilder.Select, helpText: 'Choose which layer to show', selectOptions: layers}],
            ['dataInspectorBackground', {handler: L.FormBuilder.Select, helpText: 'Choose inspector background', selectOptions: backgrounds}]
        ]);
        this.formContainer.appendChild(this.sidebarForm.build());
        this.sidebarForm.on('synced', function (e) {
            if (e.field === 'dataInspector') this.toggle();
            else if (e.field === 'dataInspectorLayer' || e.field === 'dataInspectorBackground') this.redraw();
        }, this);
        this.map.sidebar.addTab({
            label: 'Inspect',
            className: 'data-inspector',
            content: this.container,
            callback: this.sidebarForm.build,
            context: this.sidebarForm
        });
        this.map.sidebar.rebuild();
    },

    openSidebar: function () {
        this.map.sidebar.open('.data-inspector');
    },

    createToolbarButton: function () {
        var button = L.DomUtil.create('li', 'autoreload with-switch');
        this.toolbarForm = new L.K.FormBuilder(L.K.Config, [
            ['dataInspector', {handler: L.K.Switch, label: 'Data Inspector'}]
        ]);
        button.appendChild(this.toolbarForm.build());
        this.toolbarForm.on('synced', this.toggle, this);
        this.map.toolbar.addTool(button);
    },

    addCommands: function () {
        var toggleCallback = function () {
            L.K.Config.dataInspector = !L.K.Config.dataInspector;
            this.toggle();
        };
        this.map.commands.add({
            keyCode: L.K.Keys.I,
            shiftKey: true,
            ctrlKey: true,
            callback: toggleCallback,
            context: this,
            name: 'Data inspector: toggle layer'
        });
        this.map.commands.add({
            callback: this.openSidebar,
            context: this,
            name: 'Data inspector: configure'
        });
    },

    toggle: function () {
        this.toolbarForm.fetchAll();
        this.sidebarForm.fetchAll();
        if (L.K.Config.dataInspector) this.tilelayer.addTo(this.map);
        else this.map.removeLayer(this.tilelayer);
    },

    redraw: function () {
        this.tilelayer.redraw();
    }

});
